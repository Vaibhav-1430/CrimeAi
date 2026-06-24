"""Storage abstraction for evidence files.

Provides a single `storage` instance the rest of the app uses to save, read,
delete, and locate files — without knowing whether the bytes live on local disk
or (in future) in S3. To migrate to S3, implement `S3Storage` against the same
`StorageBackend` interface and switch `get_storage()`; no call sites change.
"""

from __future__ import annotations

import os
import shutil
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO


class StorageBackend(ABC):
    """Contract every storage implementation must satisfy."""

    @abstractmethod
    def save(self, file_obj: BinaryIO, *, key: str) -> str:
        """Persist a file under `key`. Returns the stored object key."""

    @abstractmethod
    def open(self, key: str) -> BinaryIO:
        """Open a stored object for reading (binary)."""

    @abstractmethod
    def delete(self, key: str) -> None:
        """Remove a stored object. Must not raise if it is already gone."""

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Whether an object exists for `key`."""

    @abstractmethod
    def url_for(self, key: str) -> str:
        """A client-usable URL/path for the object."""

    @staticmethod
    def build_key(fir_id: int, file_name: str) -> str:
        """A collision-resistant storage key namespaced by FIR.

        Example: ``evidence/fir_42/9f1c…__photo.jpg``. Keeping the original
        name as a suffix aids debugging while the uuid prevents clobbering.
        """
        safe_name = os.path.basename(file_name).replace("/", "_").replace("\\", "_")
        return f"evidence/fir_{fir_id}/{uuid.uuid4().hex}__{safe_name}"


class LocalStorage(StorageBackend):
    """Filesystem-backed storage for development.

    Files live under ``<root>/<key>`` and are served back through the
    ``/uploads`` static mount, so ``url_for`` returns ``/uploads/<key>``.
    """

    def __init__(self, root: Path, public_prefix: str = "/uploads") -> None:
        self.root = root
        self.public_prefix = public_prefix.rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # Resolve and guard against path traversal outside the root.
        full = (self.root / key).resolve()
        if not str(full).startswith(str(self.root.resolve())):
            raise ValueError("Invalid storage key")
        return full

    def save(self, file_obj: BinaryIO, *, key: str) -> str:
        destination = self._path(key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)
        return key

    def open(self, key: str) -> BinaryIO:
        return self._path(key).open("rb")

    def delete(self, key: str) -> None:
        try:
            self._path(key).unlink()
        except FileNotFoundError:
            pass

    def exists(self, key: str) -> bool:
        return self._path(key).exists()

    def url_for(self, key: str) -> str:
        return f"{self.public_prefix}/{key}"

    def size_of(self, key: str) -> int:
        return self._path(key).stat().st_size


# --- Future S3 implementation (sketch, intentionally not wired) --------------
# class S3Storage(StorageBackend):
#     def __init__(self, bucket: str, client=None, public_base_url: str | None = None):
#         import boto3
#         self.bucket = bucket
#         self.client = client or boto3.client("s3")
#         self.public_base_url = public_base_url
#     def save(self, file_obj, *, key): self.client.upload_fileobj(file_obj, self.bucket, key); return key
#     def open(self, key): return self.client.get_object(Bucket=self.bucket, Key=key)["Body"]
#     def delete(self, key): self.client.delete_object(Bucket=self.bucket, Key=key)
#     def exists(self, key):
#         from botocore.exceptions import ClientError
#         try: self.client.head_object(Bucket=self.bucket, Key=key); return True
#         except ClientError: return False
#     def url_for(self, key):
#         if self.public_base_url: return f"{self.public_base_url}/{key}"
#         return self.client.generate_presigned_url("get_object", Params={"Bucket": self.bucket, "Key": key})


_storage: StorageBackend | None = None


def get_storage() -> StorageBackend:
    """Return the configured storage backend (singleton).

    Selected via STORAGE_BACKEND env var; defaults to local disk. When S3 is
    needed, add a branch here that returns S3Storage(...) — nothing else changes.
    """
    global _storage
    if _storage is not None:
        return _storage

    backend = os.getenv("STORAGE_BACKEND", "local").lower()
    if backend == "local":
        root = Path(os.getenv("UPLOAD_ROOT", Path(__file__).resolve().parent / "uploads"))
        _storage = LocalStorage(root=root)
    else:
        raise RuntimeError(f"Unsupported STORAGE_BACKEND: {backend}")

    return _storage
