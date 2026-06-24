import hashlib
import os
import shutil
import secrets
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import hash_password, verify_password
from database import Base, SessionLocal, engine
from models import (
    AIConversation,
    AIMessage,
    ApprovalRequest,
    AuditLog,
    District,
    Evidence,
    FIR,
    FIRSuspect,
    PoliceStation,
    Role,
    Session as UserSession,
    Suspect,
    User,
    Witness,
)
from schemas import (
    AIChatRequest,
    AIConversationDetail,
    AIConversationSummary,
    BulkDeleteRequest,
    ConversationCreate,
    ConversationPin,
    ConversationRename,
    TranslateRequest,
    TranslateResponse,
    AIExplainRequest,
    AIExplainResponse,
    ExplainabilityReferences,
    AIQuestionRequest,
    AIReportRequest,
    AISearchRequest,
    AISearchResult,
    AITextResponse,
    ApprovalDecision,
    ApprovalRequestResponse,
    AuditFilterOptions,
    AuditLogListItem,
    AuditLogResponse,
    PaginatedAuditLogs,
    AuthResponse,
    ChangeRoleRequest,
    EvidenceCountResponse,
    EvidenceResponse,
    FIRCreate,
    FIRDetailResponse,
    FIRResponse,
    FIRStatusUpdate,
    AnalyticsSummary,
    NetworkGraphResponse,
    HotspotResponse,
    ForecastResponse,
    SimilarCaseItem,
    SimilarCasesResponse,
    SociologyResponse,
    LoginRequest,
    MonthlyStat,
    NamedCount,
    PaginatedFIRResponse,
    OfficerSignupRequest,
    OfficerSignupResponse,
    RefreshTokenRequest,
    RejectionDecision,
    ResetPasswordRequest,
    RoleResponse,
    SuspectCreate,
    SuspectResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
    WitnessCreate,
    WitnessResponse,
    WitnessUpdate,
)
from security import create_access_token, create_refresh_token, decode_token
from storage import get_storage
import ai_service
from ai_context import (
    build_fir_context,
    build_insights_context,
    build_related_context,
    extract_fir_references,
    search_firs,
)
from ai_readonly import get_readonly_db
import ai_rag
import network_service
import hotspot_service
import similar_cases_service
import sociology_service
from dataclasses import asdict

ROLE_NAMES = ["SuperAdmin", "StateAdmin", "DistrictAdmin", "StationOfficer", "Investigator", "Analyst"]
UPLOAD_ROOT = Path(__file__).resolve().parent / "uploads"
UPLOAD_ROOT.mkdir(exist_ok=True)
MAX_FAILED_LOGIN_ATTEMPTS = 5
ACCOUNT_LOCKOUT_MINUTES = 15
LOGIN_ATTEMPTS_BY_IP: dict[str, list[datetime]] = {}

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "Admin": {
        "dashboard:view",
        "fir:view",
        "fir:create",
        "fir:update",
        "fir:delete",
        "analytics:view",
        "admin:view",
    },
    "SuperAdmin": {
        "dashboard:view",
        "fir:view",
        "fir:create",
        "fir:update",
        "fir:delete",
        "analytics:view",
        "admin:view",
        "users:manage",
        "approvals:manage",
        "audit:view",
        "ai:use",
        "network:view",
    },
    "StateAdmin": {
        "dashboard:view",
        "fir:view",
        "analytics:view",
        "admin:view",
        "users:manage",
        "approvals:manage",
        "audit:view",
        "ai:use",
        "network:view",
    },
    "DistrictAdmin": {
        "dashboard:view",
        "fir:view",
        "analytics:view",
        "admin:view",
        "users:manage",
        "approvals:manage",
        "audit:view",
        "ai:use",
        "network:view",
    },
    "StationOfficer": {
        "dashboard:view",
        "fir:view",
        "fir:create",
        "fir:update",
    },
    "Investigator": {
        "dashboard:view",
        "fir:view",
        "fir:create",
        "fir:update",
        "fir:delete",
        "analytics:view",
        "ai:use",
        "network:view",
    },
    "Station Officer": {
        "dashboard:view",
        "fir:view",
        "fir:create",
        "fir:update",
    },
    "Analyst": {
        "fir:view",
        "analytics:view",
        "network:view",
    },
}

MEDIA_DIRECTORY_MAP = {
    "image": "images",
    "document": "documents",
    "video": "videos",
}

MEDIA_CONTENT_PREFIX = {
    "image": "image/",
    "document": "",
    "video": "video/",
}

# Evidence handling: allowed categories, size cap, and content-type mapping.
EVIDENCE_MEDIA_TYPES = {"image", "video", "pdf", "audio", "document"}
MAX_EVIDENCE_FILE_BYTES = 100 * 1024 * 1024  # 100 MB

# Map an uploaded content-type to a logical evidence category.
EVIDENCE_CONTENT_TYPE_RULES = [
    ("image/", "image"),
    ("video/", "video"),
    ("audio/", "audio"),
    ("application/pdf", "pdf"),
]


def classify_evidence_media_type(content_type: str, file_name: str) -> str:
    """Derive the logical media type from content-type, falling back to extension."""
    content_type = (content_type or "").lower()
    for prefix, media_type in EVIDENCE_CONTENT_TYPE_RULES:
        if content_type.startswith(prefix) or content_type == prefix:
            return media_type
    extension = Path(file_name or "").suffix.lower().lstrip(".")
    if extension in {"jpg", "jpeg", "png", "gif", "webp", "bmp"}:
        return "image"
    if extension in {"mp4", "mov", "avi", "mkv", "webm"}:
        return "video"
    if extension in {"mp3", "wav", "ogg", "m4a", "aac"}:
        return "audio"
    if extension == "pdf":
        return "pdf"
    return "document"

app = FastAPI(title="CrimeAI")
auth_scheme = HTTPBearer(auto_error=False)


@app.exception_handler(ai_service.AIServiceError)
def handle_ai_service_error(request: Request, exc: ai_service.AIServiceError):
    """Map AI provider failures to clean HTTP codes with a user-safe reason."""
    from fastapi.responses import JSONResponse

    status_by_category = {
        "rate_limit": 429,
        "invalid_key": 401,
        "model_unavailable": 503,
        "network": 504,
    }
    category = getattr(exc, "category", "error")
    status_code = status_by_category.get(category, 502)
    return JSONResponse(status_code=status_code, content={"detail": str(exc), "category": category})

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_user_role_columns()
    ensure_performance_indexes()
    seed_roles()
    ensure_upload_directories()
    if ai_service.is_live():
        print(
            f"[AI] Groq initialized successfully — model={ai_service.active_model()} "
            f"(fallback {ai_service.fallback_model()})"
        )
    else:
        print("[AI] Groq API key missing — AI assistant running in mock fallback mode")


def ensure_user_role_columns() -> None:
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS rank VARCHAR"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS district_id INTEGER"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS station_id INTEGER"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'Pending'"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0"))
        connection.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP"))
        connection.execute(text("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id INTEGER"))
        connection.execute(text("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR"))
        connection.execute(text("ALTER TABLE audit_logs ALTER COLUMN fir_id DROP NOT NULL"))
        connection.execute(text("ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_size INTEGER"))
        connection.execute(text("ALTER TABLE evidence ADD COLUMN IF NOT EXISTS description TEXT"))
        connection.execute(text("ALTER TABLE suspects ADD COLUMN IF NOT EXISTS gender VARCHAR"))
        connection.execute(text("ALTER TABLE suspects ADD COLUMN IF NOT EXISTS occupation VARCHAR"))
        connection.execute(text("ALTER TABLE suspects ADD COLUMN IF NOT EXISTS education VARCHAR"))
        connection.execute(text("ALTER TABLE suspects ADD COLUMN IF NOT EXISTS income_band VARCHAR"))
        connection.execute(text("ALTER TABLE suspects ADD COLUMN IF NOT EXISTS employment_status VARCHAR"))
        connection.execute(text("ALTER TABLE suspects ADD COLUMN IF NOT EXISTS is_migrant BOOLEAN"))


def ensure_performance_indexes() -> None:
    """Create indexes that back FIR filtering, pagination, and analytics.

    At 100k+ FIRs these turn the list/analytics filters from full scans into
    index lookups. IF NOT EXISTS keeps startup idempotent.
    """
    with engine.begin() as connection:
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_firs_status ON firs (status)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_firs_district_id ON firs (district_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_firs_crime_type ON firs (crime_type)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_firs_incident_date ON firs (incident_date)"))
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_firs_police_station_id ON firs (police_station_id)")
        )
        # Supports ordering the list newest-first within a filtered set.
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_firs_id_desc ON firs (id DESC)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_evidence_fir_id ON evidence (fir_id)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_witnesses_fir_id ON witnesses (fir_id)"))
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_fir_suspects_fir_id ON fir_suspects (fir_id)")
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_fir_id ON audit_logs (fir_id)"))
        # Audit query/pagination: newest-first listing + per-column filters.
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at DESC)")
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs (action)"))
        connection.execute(
            text("CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_type ON audit_logs (entity_type)")
        )
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs (user_id)"))


def ensure_upload_directories() -> None:
    UPLOAD_ROOT.mkdir(exist_ok=True)
    for directory_name in MEDIA_DIRECTORY_MAP.values():
        (UPLOAD_ROOT / directory_name).mkdir(exist_ok=True)


def seed_roles() -> None:
    db = SessionLocal()
    try:
        for role_name in ROLE_NAMES:
            existing_role = db.query(Role).filter(Role.name == role_name).first()
            if not existing_role:
                db.add(Role(name=role_name))
        db.commit()

        for user in db.query(User).all():
            if user.role == "Admin":
                user.role = "SuperAdmin"
            if user.role == "Station Officer":
                user.role = "StationOfficer"
            if not user.status:
                user.status = "Approved"
            role = db.query(Role).filter(Role.name == user.role).first()
            if role and user.role_id != role.id:
                user.role_id = role.id
        db.commit()
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(auth_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("user_id")
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if user.status != "Approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status}. Access is not enabled.",
        )

    return user


def require_permission(permission: str) -> Callable[[User], User]:
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        permissions = ROLE_PERMISSIONS.get(current_user.role, set())
        if permission not in permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return current_user

    return dependency


def user_to_response(user: User) -> UserResponse:
    # Serialize the full user (status, role_id, district/station, etc.) so the
    # frontend auth context reflects the real account state. Constructing with
    # only a few fields let Pydantic fall back to defaults like status="Pending".
    return UserResponse.model_validate(user)


def get_client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else None


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def enforce_login_rate_limit(ip_address: str | None) -> None:
    if not ip_address:
        return
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=1)
    attempts = [attempt for attempt in LOGIN_ATTEMPTS_BY_IP.get(ip_address, []) if attempt > window_start]
    attempts.append(now)
    LOGIN_ATTEMPTS_BY_IP[ip_address] = attempts
    if len(attempts) > 20:
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again shortly.")


def issue_tokens(user: User, response: Response, db: Session, request: Request | None = None) -> AuthResponse:
    token_payload = {
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
    }
    access_token = create_access_token(token_payload)
    refresh_token = create_refresh_token(token_payload)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    db.add(
        UserSession(
            user_id=user.id,
            refresh_token_hash=hash_refresh_token(refresh_token),
            expires_at=expires_at,
            ip_address=get_client_ip(request),
        )
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=7 * 24 * 60 * 60,
        path="/",
    )

    return AuthResponse(access_token=access_token, user=user_to_response(user))


def get_fir_or_404(fir_id: int, db: Session) -> FIR:
    fir = db.query(FIR).filter(FIR.id == fir_id).first()
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    return fir


def create_audit_log(
    *,
    db: Session,
    fir_id: int | None = None,
    user_id: int | None = None,
    action: str,
    entity_type: str,
    description: str,
    performed_by: int | None,
    entity_id: int | None = None,
    ip_address: str | None = None,
) -> None:
    db.add(
        AuditLog(
            fir_id=fir_id,
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            performed_by=performed_by,
            ip_address=ip_address,
        )
    )


def save_upload_file(file: UploadFile, media_type: str, fir_id: int) -> tuple[str, str]:
    """Persist an upload through the storage backend. Returns (key, content_type)."""
    storage = get_storage()
    key = storage.build_key(fir_id, file.filename or "attachment")
    file.file.seek(0)
    storage.save(file.file, key=key)
    content_type = file.content_type or "application/octet-stream"
    return key, content_type


def validate_media_type(file: UploadFile, media_type: str) -> None:
    content_type = file.content_type or ""
    if media_type == "image" and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed for image evidence")
    if media_type == "video" and not content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Only video files are allowed for video evidence")


def read_upload_size(file: UploadFile) -> int:
    """Measure an upload's size and validate it against the cap (rewinds after)."""
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_EVIDENCE_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the maximum size of {MAX_EVIDENCE_FILE_BYTES // (1024 * 1024)} MB",
        )
    return size


def evidence_to_response(item: Evidence) -> EvidenceResponse:
    """Serialize evidence, deriving a client-usable file_url from the storage key."""
    storage = get_storage()
    response = EvidenceResponse.model_validate(item)
    response.file_url = storage.url_for(item.file_path)
    return response


def build_case_detail(fir: FIR, db: Session) -> FIRDetailResponse:
    evidence = db.query(Evidence).filter(Evidence.fir_id == fir.id).order_by(Evidence.created_at.desc()).all()
    witnesses = db.query(Witness).filter(Witness.fir_id == fir.id).order_by(Witness.created_at.desc()).all()
    suspect_links = (
        db.query(FIRSuspect)
        .filter(FIRSuspect.fir_id == fir.id)
        .order_by(FIRSuspect.linked_at.desc())
        .all()
    )
    suspects = [link.suspect for link in suspect_links]
    audit_logs = (
        db.query(AuditLog)
        .filter(AuditLog.fir_id == fir.id)
        .order_by(AuditLog.created_at.desc())
        .all()
    )

    return FIRDetailResponse(
        fir=FIRResponse.model_validate(fir),
        evidence=[evidence_to_response(item) for item in evidence],
        witnesses=[WitnessResponse.model_validate(item) for item in witnesses],
        suspects=[SuspectResponse.model_validate(item) for item in suspects],
        audit_logs=[AuditLogResponse.model_validate(item) for item in audit_logs],
    )


def scoped_users_query(db: Session, current_user: User):
    query = db.query(User)
    if current_user.role == "DistrictAdmin":
        query = query.filter(User.district_id == current_user.district_id)
    if current_user.role == "StationOfficer":
        query = query.filter(User.station_id == current_user.station_id)
    return query


def approval_to_response(approval: ApprovalRequest) -> ApprovalRequestResponse:
    return ApprovalRequestResponse(
        id=approval.id,
        user_id=approval.user_id,
        status=approval.status,
        requested_role_id=approval.requested_role_id,
        requested_district_id=approval.requested_district_id,
        requested_station_id=approval.requested_station_id,
        reviewed_by=approval.reviewed_by,
        reviewed_at=approval.reviewed_at,
        rejection_reason=approval.rejection_reason,
        created_at=approval.created_at,
        user=UserResponse.model_validate(approval.user),
    )


app.mount("/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")


@app.get("/")
def root():
    return {"message": "CrimeAI Backend Running"}


@app.get(
    "/roles",
    response_model=list[RoleResponse],
    dependencies=[Depends(require_permission("admin:view"))],
)
def get_roles(db: Session = Depends(get_db)):
    return db.query(Role).filter(Role.name.in_(ROLE_NAMES)).order_by(Role.name).all()


@app.get("/public/districts")
def get_public_districts(db: Session = Depends(get_db)):
    return db.query(District).order_by(District.name).all()


@app.get("/public/police-stations")
def get_public_police_stations(district_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(PoliceStation)
    if district_id:
        query = query.filter(PoliceStation.district_id == district_id)
    return query.order_by(PoliceStation.name).all()


@app.post("/signup", response_model=OfficerSignupResponse)
def signup_officer(payload: OfficerSignupRequest, request: Request, db: Session = Depends(get_db)):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    if not any(character.isupper() for character in payload.password) or not any(
        character.isdigit() for character in payload.password
    ):
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least one uppercase letter and one number",
        )

    existing_user = (
        db.query(User)
        .filter((User.email == payload.email) | (User.employee_id == payload.employee_id))
        .first()
    )
    if existing_user:
        raise HTTPException(status_code=409, detail="Officer email or employee ID already exists")

    default_role = db.query(Role).filter(Role.name == "Investigator").first()
    if not default_role:
        raise HTTPException(status_code=500, detail="Default onboarding role is not configured")

    officer = User(
        name=payload.name,
        email=payload.email,
        employee_id=payload.employee_id,
        mobile_number=payload.mobile_number,
        rank=payload.rank,
        password_hash=hash_password(payload.password),
        role=default_role.name,
        role_id=default_role.id,
        district_id=payload.district_id,
        station_id=payload.station_id,
        status="Pending",
    )
    db.add(officer)
    db.flush()

    db.add(
        ApprovalRequest(
            user_id=officer.id,
            status="Pending",
            requested_role_id=default_role.id,
            requested_district_id=payload.district_id,
            requested_station_id=payload.station_id,
        )
    )
    create_audit_log(
        db=db,
        user_id=officer.id,
        action="User Creation",
        entity_type="user",
        entity_id=officer.id,
        description=f"Officer onboarding submitted for {officer.employee_id}.",
        performed_by=None,
        ip_address=get_client_ip(request),
    )
    db.commit()
    return OfficerSignupResponse(message="Officer onboarding submitted for approval.", status="Pending")


@app.post("/register")
def register_disabled():
    raise HTTPException(status_code=410, detail="Public registration is disabled. Use officer onboarding.")


def authenticate_user(payload: LoginRequest, response: Response, request: Request, db: Session) -> AuthResponse:
    ip_address = get_client_ip(request)
    enforce_login_rate_limit(ip_address)
    db_user = db.query(User).filter(User.email == payload.email).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    now = datetime.now(timezone.utc)
    if db_user.locked_until and db_user.locked_until.replace(tzinfo=timezone.utc) > now:
        raise HTTPException(status_code=423, detail="Account is temporarily locked")

    if db_user.status != "Approved":
        raise HTTPException(status_code=403, detail=f"Account is {db_user.status}. Access is not enabled.")

    if not verify_password(payload.password, db_user.password_hash):
        db_user.failed_login_attempts = (db_user.failed_login_attempts or 0) + 1
        if db_user.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            db_user.locked_until = datetime.utcnow() + timedelta(minutes=ACCOUNT_LOCKOUT_MINUTES)
        db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    db_user.failed_login_attempts = 0
    db_user.locked_until = None
    create_audit_log(
        db=db,
        user_id=db_user.id,
        action="Login",
        entity_type="session",
        entity_id=db_user.id,
        description=f"{db_user.name} logged in.",
        performed_by=db_user.id,
        ip_address=ip_address,
    )
    auth_response = issue_tokens(db_user, response, db, request)
    db.commit()
    return auth_response


@app.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    return authenticate_user(payload, response, request, db)


@app.post("/login", response_model=AuthResponse)
def login_legacy(payload: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    return authenticate_user(payload, response, request, db)


@app.post("/auth/refresh", response_model=AuthResponse)
def refresh_access_token(
    request: Request,
    response: Response,
    payload: RefreshTokenRequest | None = None,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    token = payload.refresh_token if payload and payload.refresh_token else refresh_token

    if not token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    try:
        decoded = decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    session = (
        db.query(UserSession)
        .filter(
            UserSession.refresh_token_hash == hash_refresh_token(token),
            UserSession.revoked_at.is_(None),
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=401, detail="Refresh token has expired or was revoked")

    user = db.query(User).filter(User.id == decoded.get("user_id")).first()
    if not user or user.status != "Approved":
        raise HTTPException(status_code=401, detail="User not found")

    session.revoked_at = datetime.utcnow()
    auth_response = issue_tokens(user, response, db, request)
    db.commit()
    return auth_response


@app.post("/auth/logout")
def logout(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    if refresh_token:
        session = (
            db.query(UserSession)
            .filter(UserSession.refresh_token_hash == hash_refresh_token(refresh_token))
            .first()
        )
        if session and not session.revoked_at:
            session.revoked_at = datetime.utcnow()

    if current_user:
        create_audit_log(
            db=db,
            user_id=current_user.id,
            action="Logout",
            entity_type="session",
            entity_id=current_user.id,
            description=f"{current_user.name} logged out.",
            performed_by=current_user.id,
            ip_address=get_client_ip(request),
        )
    db.commit()
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out"}


@app.post("/logout")
def logout_legacy(
    request: Request,
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    return logout(request, response, refresh_token, db, current_user)


@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return user_to_response(current_user)


@app.get(
    "/admin/approvals",
    response_model=list[ApprovalRequestResponse],
    dependencies=[Depends(require_permission("approvals:manage"))],
)
def get_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(ApprovalRequest)
        .join(User, ApprovalRequest.user_id == User.id)
        .filter(ApprovalRequest.status == "Pending")
    )
    if current_user.role == "DistrictAdmin":
        query = query.filter(User.district_id == current_user.district_id)
    approvals = query.order_by(ApprovalRequest.created_at.desc()).all()
    return [approval_to_response(item) for item in approvals]


@app.post(
    "/admin/approvals/{approval_id}/approve",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("approvals:manage"))],
)
def approve_officer(
    approval_id: int,
    payload: ApprovalDecision,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval or approval.status != "Pending":
        raise HTTPException(status_code=404, detail="Pending approval request not found")

    user = approval.user
    if current_user.role == "DistrictAdmin" and user.district_id != current_user.district_id:
        raise HTTPException(status_code=403, detail="Cannot approve officers outside your district")

    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")

    user.status = "Approved"
    user.role_id = role.id
    user.role = role.name
    user.district_id = payload.district_id
    user.station_id = payload.station_id
    approval.status = "Approved"
    approval.reviewed_by = current_user.id
    approval.reviewed_at = datetime.utcnow()
    approval.requested_role_id = payload.role_id
    approval.requested_district_id = payload.district_id
    approval.requested_station_id = payload.station_id
    create_audit_log(
        db=db,
        user_id=user.id,
        action="Approval",
        entity_type="user",
        entity_id=user.id,
        description=f"Officer {user.employee_id} approved as {role.name}.",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return user_to_response(user)


@app.post(
    "/admin/approvals/{approval_id}/reject",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("approvals:manage"))],
)
def reject_officer(
    approval_id: int,
    payload: RejectionDecision,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    approval = db.query(ApprovalRequest).filter(ApprovalRequest.id == approval_id).first()
    if not approval or approval.status != "Pending":
        raise HTTPException(status_code=404, detail="Pending approval request not found")

    user = approval.user
    if current_user.role == "DistrictAdmin" and user.district_id != current_user.district_id:
        raise HTTPException(status_code=403, detail="Cannot reject officers outside your district")

    user.status = "Rejected"
    approval.status = "Rejected"
    approval.reviewed_by = current_user.id
    approval.reviewed_at = datetime.utcnow()
    approval.rejection_reason = payload.reason
    create_audit_log(
        db=db,
        user_id=user.id,
        action="Rejection",
        entity_type="user",
        entity_id=user.id,
        description=f"Officer {user.employee_id} rejected: {payload.reason}",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return user_to_response(user)


@app.get(
    "/admin/users",
    response_model=list[UserResponse],
    dependencies=[Depends(require_permission("users:manage"))],
)
def get_users(
    search: str | None = None,
    role_id: int | None = None,
    district_id: int | None = None,
    station_id: int | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = scoped_users_query(db, current_user)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (User.name.ilike(pattern))
            | (User.email.ilike(pattern))
            | (User.employee_id.ilike(pattern))
        )
    if role_id:
        query = query.filter(User.role_id == role_id)
    if district_id:
        query = query.filter(User.district_id == district_id)
    if station_id:
        query = query.filter(User.station_id == station_id)
    if status_filter:
        query = query.filter(User.status == status_filter)
    return [user_to_response(user) for user in query.order_by(User.created_at.desc()).all()]


@app.put(
    "/admin/users/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("users:manage"))],
)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = scoped_users_query(db, current_user).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")

    previous_role = user.role
    user.name = payload.name
    user.email = payload.email
    user.employee_id = payload.employee_id
    user.mobile_number = payload.mobile_number
    user.rank = payload.rank
    user.role_id = role.id
    user.role = role.name
    user.district_id = payload.district_id
    user.station_id = payload.station_id
    user.status = payload.status
    create_audit_log(
        db=db,
        user_id=user.id,
        action="Role Changes" if previous_role != user.role else "User Updated",
        entity_type="user",
        entity_id=user.id,
        description=f"User {user.employee_id} updated by {current_user.email}.",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return user_to_response(user)


@app.post(
    "/admin/users/{user_id}/suspend",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("users:manage"))],
)
def suspend_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = scoped_users_query(db, current_user).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "Suspended"
    create_audit_log(
        db=db,
        user_id=user.id,
        action="Suspension",
        entity_type="user",
        entity_id=user.id,
        description=f"User {user.employee_id} suspended.",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return user_to_response(user)


@app.post(
    "/admin/users/{user_id}/reactivate",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("users:manage"))],
)
def reactivate_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = scoped_users_query(db, current_user).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "Approved"
    create_audit_log(
        db=db,
        user_id=user.id,
        action="Reactivation",
        entity_type="user",
        entity_id=user.id,
        description=f"User {user.employee_id} reactivated.",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return user_to_response(user)


@app.post(
    "/admin/users/{user_id}/reset-password",
    dependencies=[Depends(require_permission("users:manage"))],
)
def reset_user_password(
    user_id: int,
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = scoped_users_query(db, current_user).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(payload.password)
    create_audit_log(
        db=db,
        user_id=user.id,
        action="Password Reset",
        entity_type="user",
        entity_id=user.id,
        description=f"Password reset for {user.employee_id}.",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    return {"message": "Password reset successfully"}


@app.post(
    "/admin/users/{user_id}/change-role",
    response_model=UserResponse,
    dependencies=[Depends(require_permission("users:manage"))],
)
def change_user_role(
    user_id: int,
    payload: ChangeRoleRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = scoped_users_query(db, current_user).filter(User.id == user_id).first()
    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not user or not role:
        raise HTTPException(status_code=404, detail="User or role not found")
    previous_role = user.role
    user.role = role.name
    user.role_id = role.id
    create_audit_log(
        db=db,
        user_id=user.id,
        action="Role Changes",
        entity_type="user",
        entity_id=user.id,
        description=f"Role changed from {previous_role} to {role.name}.",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    db.refresh(user)
    return user_to_response(user)


@app.post("/firs", dependencies=[Depends(require_permission("fir:create"))])
def create_fir(
    fir: FIRCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_fir = FIR(**fir.model_dump())
    db.add(new_fir)
    db.flush()
    create_audit_log(
        db=db,
        fir_id=new_fir.id,
        action="FIR Created",
        entity_type="fir",
        entity_id=new_fir.id,
        description=f"FIR {new_fir.fir_number} created with status {new_fir.status}.",
        performed_by=current_user.id,
    )
    db.commit()
    db.refresh(new_fir)
    return {"message": "FIR Created", "id": new_fir.id}


@app.get(
    "/firs",
    response_model=PaginatedFIRResponse,
    dependencies=[Depends(require_permission("fir:view"))],
)
def get_firs(
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    status_filter: str | None = None,
    district_id: int | None = None,
    crime_type: str | None = None,
    db: Session = Depends(get_db),
):
    """Paginated, server-side-filtered FIR list.

    Returns a page of records plus the total count so the UI can render
    page controls without ever fetching all 100k rows.
    """
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    query = db.query(FIR)
    if search:
        pattern = f"%{search}%"
        query = query.filter((FIR.fir_number.ilike(pattern)) | (FIR.crime_type.ilike(pattern)))
    if status_filter:
        query = query.filter(FIR.status == status_filter)
    if district_id:
        query = query.filter(FIR.district_id == district_id)
    if crime_type:
        query = query.filter(FIR.crime_type == crime_type)

    total = query.with_entities(func.count(FIR.id)).scalar() or 0
    items = (
        query.order_by(FIR.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    total_pages = (total + page_size - 1) // page_size if total else 0

    return PaginatedFIRResponse(
        items=[FIRResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@app.get(
    "/analytics/summary",
    response_model=AnalyticsSummary,
    dependencies=[Depends(require_permission("analytics:view"))],
)
def analytics_summary(db: Session = Depends(get_db)):
    """Aggregate analytics computed in SQL instead of shipping 100k rows.

    Each chart is a small GROUP BY (a few dozen rows at most), so the whole
    payload is tiny and the database does the counting with indexes.
    """
    total_firs = db.query(func.count(FIR.id)).scalar() or 0
    closed_cases = (
        db.query(func.count(FIR.id)).filter(FIR.status == "Closed").scalar() or 0
    )
    open_cases = total_firs - closed_cases
    crime_type_count = db.query(func.count(func.distinct(FIR.crime_type))).scalar() or 0

    district_rows = (
        db.query(District.name, func.count(FIR.id))
        .join(FIR, FIR.district_id == District.id)
        .group_by(District.name)
        .order_by(func.count(FIR.id).desc())
        .all()
    )
    crime_rows = (
        db.query(FIR.crime_type, func.count(FIR.id))
        .group_by(FIR.crime_type)
        .order_by(func.count(FIR.id).desc())
        .all()
    )
    status_rows = (
        db.query(FIR.status, func.count(FIR.id))
        .group_by(FIR.status)
        .order_by(func.count(FIR.id).desc())
        .all()
    )

    month = func.to_char(FIR.incident_date, "YYYY-MM")
    monthly_rows = (
        db.query(
            month.label("month"),
            func.count(FIR.id).label("total"),
            func.count(FIR.id).filter(FIR.status != "Closed").label("open"),
            func.count(FIR.id).filter(FIR.status == "Closed").label("closed"),
        )
        .group_by(month)
        .order_by(month)
        .all()
    )

    return AnalyticsSummary(
        total_firs=total_firs,
        open_cases=open_cases,
        closed_cases=closed_cases,
        crime_type_count=crime_type_count,
        district_stats=[NamedCount(name=name, count=count) for name, count in district_rows],
        crime_type_stats=[NamedCount(name=name, count=count) for name, count in crime_rows],
        status_stats=[NamedCount(name=name, count=count) for name, count in status_rows],
        monthly_stats=[
            MonthlyStat(month=row.month, total=row.total, open=row.open, closed=row.closed)
            for row in monthly_rows
        ],
    )


# --- Audit log / activity tracking (admin-only, read-only) ------------------

def audit_row_to_item(log: AuditLog, user_name: str | None, role: str | None) -> AuditLogListItem:
    return AuditLogListItem(
        id=log.id,
        user_id=log.user_id,
        user_name=user_name,
        role=role,
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        description=log.description,
        ip_address=log.ip_address,
        created_at=log.created_at,
    )


def build_audit_query(db: Session):
    """Base query joining audit logs to the acting user (left join keeps system rows)."""
    return (
        db.query(AuditLog, User.name, User.role)
        .outerjoin(User, AuditLog.user_id == User.id)
    )


@app.get(
    "/audit-logs",
    response_model=PaginatedAuditLogs,
    dependencies=[Depends(require_permission("audit:view"))],
)
def get_audit_logs(
    page: int = 1,
    page_size: int = 25,
    search: str | None = None,
    user_id: int | None = None,
    role: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    """Admin-only, paginated, filtered audit trail.

    Logs are immutable and read-only — there are deliberately no create/update/
    delete endpoints. Filtering is backed by indexes on created_at, action,
    entity_type, and user_id.
    """
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)

    query = build_audit_query(db)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (AuditLog.description.ilike(pattern))
            | (AuditLog.action.ilike(pattern))
            | (User.name.ilike(pattern))
        )
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if role:
        query = query.filter(User.role == role)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if date_from:
        query = query.filter(AuditLog.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(AuditLog.created_at <= datetime.combine(date_to, datetime.max.time()))

    total = query.with_entities(func.count(AuditLog.id)).scalar() or 0
    rows = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    total_pages = (total + page_size - 1) // page_size if total else 0

    return PaginatedAuditLogs(
        items=[audit_row_to_item(log, name, role_name) for log, name, role_name in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@app.get(
    "/audit-logs/recent",
    response_model=list[AuditLogListItem],
    dependencies=[Depends(require_permission("audit:view"))],
)
def get_recent_audit_logs(limit: int = 10, db: Session = Depends(get_db)):
    """Most recent activities for the dashboard widget."""
    limit = min(max(limit, 1), 50)
    rows = (
        build_audit_query(db)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(limit)
        .all()
    )
    return [audit_row_to_item(log, name, role_name) for log, name, role_name in rows]


@app.get(
    "/audit-logs/filter-options",
    response_model=AuditFilterOptions,
    dependencies=[Depends(require_permission("audit:view"))],
)
def get_audit_filter_options(db: Session = Depends(get_db)):
    """Distinct actions, entity types, and roles to populate filter dropdowns."""
    actions = [a for (a,) in db.query(AuditLog.action).distinct().order_by(AuditLog.action).all() if a]
    entity_types = [
        e for (e,) in db.query(AuditLog.entity_type).distinct().order_by(AuditLog.entity_type).all() if e
    ]
    roles = [r for (r,) in db.query(User.role).distinct().order_by(User.role).all() if r]
    return AuditFilterOptions(actions=actions, entity_types=entity_types, roles=roles)


# --- AI Investigation Assistant (Groq, read-only) ----------------------------

def log_ai_query(
    *,
    current_user: User,
    feature: str,
    detail: str,
    request: Request | None = None,
) -> None:
    """Persist every AI query to the audit trail (writes to the normal R/W DB).

    Uses its own short-lived read/write session so the AI request handlers can
    depend solely on the read-only DB for case data.
    """
    write_db = SessionLocal()
    try:
        write_db.add(
            AuditLog(
                user_id=current_user.id,
                action="AI Query",
                entity_type="ai",
                description=f"AI {feature}: {detail[:240]}",
                performed_by=current_user.id,
                ip_address=get_client_ip(request),
            )
        )
        write_db.commit()
    finally:
        write_db.close()


def _save_chat_message(conversation_id: int, user_id: int, role: str, content: str) -> None:
    """Persist a chat message to a user-owned conversation (own write session).

    Silently no-ops if the conversation doesn't exist or isn't owned by the user
    (so a bad conversation_id never breaks the chat stream).
    """
    if not content.strip():
        return
    write_db = SessionLocal()
    try:
        conv = (
            write_db.query(AIConversation)
            .filter(
                AIConversation.id == conversation_id,
                AIConversation.user_id == user_id,
                AIConversation.deleted_at.is_(None),
            )
            .first()
        )
        if not conv:
            return
        write_db.add(AIMessage(conversation_id=conv.id, role=role, content=content))
        # Auto-title from the first user message.
        if role == "user" and (not conv.title or conv.title == "New conversation"):
            conv.title = (content.strip()[:60]) or "New conversation"
        conv.updated_at = datetime.utcnow()
        write_db.commit()
    finally:
        write_db.close()


SUGGESTED_QUESTIONS = [
    "What evidence is missing in this case?",
    "What witnesses should be interviewed next?",
    "What leads should be investigated?",
    "Summarize this FIR for a daily briefing.",
    "Are there related cases or repeat suspects?",
]


def _readonly_fir_or_404(fir_id: int, db: Session) -> FIR:
    fir = db.query(FIR).filter(FIR.id == fir_id).first()
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    return fir


@app.get("/ai/status", dependencies=[Depends(require_permission("ai:use"))])
def ai_status():
    """Report AI provider, model, health, and the suggested prompts.

    Keeps the `live` / `model` / `suggested_questions` keys the frontend already
    consumes, and adds provider + fallback + health for the new status view.
    """
    health = ai_service.health()
    return {
        # Existing keys (frontend depends on these).
        "live": ai_service.is_live(),
        "model": ai_service.active_model(),
        "suggested_questions": SUGGESTED_QUESTIONS,
        # New provider/health metadata.
        "provider": ai_service.PROVIDER,
        "fallback_model": ai_service.fallback_model(),
        "health": health["status"],
        "health_detail": health.get("detail", ""),
    }


@app.post(
    "/ai/summarize",
    response_model=AITextResponse,
    dependencies=[Depends(require_permission("ai:use"))],
)
def ai_summarize_fir(
    payload: AIQuestionRequest,
    request: Request,
    db: Session = Depends(get_readonly_db),
    current_user: User = Depends(get_current_user),
):
    """FIR Summarization → crime summary, key facts, victims, suspects, timeline."""
    fir = _readonly_fir_or_404(payload.fir_id, db)
    context = build_fir_context(db, fir)
    prompt = (
        "Summarize the following FIR for an investigating officer. Use these "
        "sections with markdown headings: Crime Summary, Key Facts, Victims, "
        "Suspects, Timeline. Be concise and only use facts present in the data.\n\n"
        f"{context}"
    )
    content = ai_service.generate("fir_summary", prompt)
    log_ai_query(current_user=current_user, feature="summarize", detail=fir.fir_number, request=request)
    return AITextResponse(feature="fir_summary", content=content, live=ai_service.is_live())


@app.post(
    "/ai/assistant",
    response_model=AITextResponse,
    dependencies=[Depends(require_permission("ai:use"))],
)
def ai_investigation_assistant(
    payload: AIQuestionRequest,
    request: Request,
    db: Session = Depends(get_readonly_db),
    current_user: User = Depends(get_current_user),
):
    """Investigation Assistant: missing evidence, witnesses, leads (or custom Q)."""
    fir = _readonly_fir_or_404(payload.fir_id, db)
    context = build_fir_context(db, fir)
    question = payload.question or (
        "Analyze this case and answer: (1) What evidence is missing? "
        "(2) What witnesses should be interviewed? (3) What leads should be "
        "investigated next?"
    )
    prompt = (
        f"{question}\n\nBase your answer strictly on the case data below. "
        "Flag anything that cannot be determined from the available information.\n\n"
        f"{context}"
    )
    content = ai_service.generate("assistant", prompt)
    log_ai_query(current_user=current_user, feature="assistant", detail=question, request=request)
    return AITextResponse(feature="assistant", content=content, live=ai_service.is_live())


@app.post(
    "/ai/explain",
    response_model=AIExplainResponse,
    dependencies=[Depends(require_permission("ai:use"))],
)
def ai_explain(
    payload: AIExplainRequest,
    request: Request,
    db: Session = Depends(get_readonly_db),
    current_user: User = Depends(get_current_user),
):
    """Explainable AI: an answer plus a grounded evidence trail, an ordered
    reasoning chain, and a confidence score.

    The references (data sources, FIR/evidence/suspect/witness IDs) are computed
    server-side from the exact records pulled into context — they are the source
    of truth and are NOT taken from the model. The reasoning chain and
    confidence come from the model's structured output.
    """
    fir = _readonly_fir_or_404(payload.fir_id, db)
    context = build_fir_context(db, fir)
    references = extract_fir_references(db, fir)
    question = payload.question or (
        "Assess this case: what is the current investigative picture, what is "
        "missing, and what should be done next?"
    )

    try:
        explained = ai_service.generate_explained("explain", question, context)
    except ai_service.AIServiceError as exc:
        # Model unavailable (e.g. quota). Still return the grounded references so
        # the evidence trail renders; signal the failure via confidence 0.
        explained = {
            "answer": f"AI reasoning is temporarily unavailable: {exc}",
            "recommendation": "Retry once the AI service is available; the evidence trail below is from live records.",
            "reasoning_chain": [],
            "confidence": 0.0,
            "confidence_rationale": "No model output was produced.",
        }
    log_ai_query(current_user=current_user, feature="explain", detail=question, request=request)

    return AIExplainResponse(
        feature="explain",
        live=ai_service.is_live(),
        answer=explained["answer"],
        recommendation=explained["recommendation"],
        reasoning_chain=explained["reasoning_chain"],
        confidence=explained["confidence"],
        confidence_rationale=explained["confidence_rationale"],
        references=ExplainabilityReferences(
            firs=references["firs"],
            evidence=references["evidence"],
            suspects=references["suspects"],
            witnesses=references["witnesses"],
            data_sources=references["data_sources"],
        ),
    )


@app.post(
    "/ai/related",
    response_model=AITextResponse,
    dependencies=[Depends(require_permission("ai:use"))],
)
def ai_related_cases(
    payload: AIQuestionRequest,
    request: Request,
    db: Session = Depends(get_readonly_db),
    current_user: User = Depends(get_current_user),
):
    """Related Case Detection: similar FIRs, suspects, and crime patterns."""
    fir = _readonly_fir_or_404(payload.fir_id, db)
    context = build_related_context(db, fir)
    prompt = (
        "Identify likely related cases for the target FIR. Group findings under: "
        "Similar FIRs, Similar Suspects, Similar Crime Patterns. For each, explain "
        "why it may be connected. Only reference FIRs/suspects in the data.\n\n"
        f"{context}"
    )
    content = ai_service.generate("related", prompt)
    log_ai_query(current_user=current_user, feature="related", detail=fir.fir_number, request=request)
    return AITextResponse(feature="related", content=content, live=ai_service.is_live())


@app.post(
    "/ai/search",
    response_model=AISearchResult,
    dependencies=[Depends(require_permission("ai:use"))],
)
def ai_natural_language_search(
    payload: AISearchRequest,
    request: Request,
    db: Session = Depends(get_readonly_db),
    current_user: User = Depends(get_current_user),
):
    """Natural-language search → structured filters → read-only FIR query."""
    prompt = (
        "Translate the investigator's natural-language query into a JSON object "
        'with shape {"filters": {"crime_type": str?, "status": one of '
        '["Open","Under Investigation","Chargesheet Filed","Closed"]?, '
        '"district": str?, "keyword": str?, "date_from": "YYYY-MM-DD"?, '
        '"date_to": "YYYY-MM-DD"?}, "explanation": str}. Omit fields not implied. '
        f'Query: "{payload.query}"'
    )
    parsed = ai_service.generate_json("nl_search", prompt)
    filters = parsed.get("filters", {}) if isinstance(parsed, dict) else {}
    explanation = parsed.get("explanation", "") if isinstance(parsed, dict) else ""
    results = search_firs(db, filters)
    log_ai_query(current_user=current_user, feature="search", detail=payload.query, request=request)
    return AISearchResult(
        interpreted_filters=filters,
        explanation=explanation,
        results=[FIRResponse.model_validate(item) for item in results],
    )


@app.post(
    "/ai/report",
    response_model=AITextResponse,
    dependencies=[Depends(require_permission("ai:use"))],
)
def ai_generate_report(
    payload: AIReportRequest,
    request: Request,
    db: Session = Depends(get_readonly_db),
    current_user: User = Depends(get_current_user),
):
    """AI Case Report Generator: investigation report / daily briefing / summary."""
    fir = _readonly_fir_or_404(payload.fir_id, db)
    context = build_fir_context(db, fir)
    instructions = {
        "investigation": (
            "Write a formal Investigation Report with sections: Case Overview, "
            "Findings, Evidence Assessment, Witness Assessment, Suspect Assessment, "
            "Recommended Next Steps, Conclusion."
        ),
        "daily_briefing": (
            "Write a concise Daily Briefing (under 250 words) covering current "
            "status, what changed recently, and the top 3 priorities for today."
        ),
        "case_summary": (
            "Write an executive Case Summary suitable for a senior officer: what "
            "happened, where the case stands, and key open questions."
        ),
    }
    prompt = (
        f"{instructions.get(payload.report_type, instructions['investigation'])}\n\n"
        "Use only the case data below.\n\n"
        f"{context}"
    )
    content = ai_service.generate(f"report_{payload.report_type}", prompt)
    log_ai_query(
        current_user=current_user,
        feature=f"report:{payload.report_type}",
        detail=fir.fir_number,
        request=request,
    )
    return AITextResponse(feature=f"report_{payload.report_type}", content=content, live=ai_service.is_live())


@app.get(
    "/ai/insights",
    response_model=AITextResponse,
    dependencies=[Depends(require_permission("ai:use"))],
)
def ai_insights(
    request: Request,
    db: Session = Depends(get_readonly_db),
    current_user: User = Depends(get_current_user),
):
    """AI Insights Dashboard: trends, emerging patterns, repeat offenders, hotspots."""
    context = build_insights_context(db)
    prompt = (
        "Analyze the aggregate crime data below and produce an intelligence brief "
        "with sections: Crime Trends, Emerging Patterns, Repeat Offenders, "
        "High-Risk Locations, Recommended Focus Areas. Base every claim on the data.\n\n"
        f"{context}"
    )
    content = ai_service.generate("insights", prompt)
    log_ai_query(current_user=current_user, feature="insights", detail="dashboard", request=request)
    return AITextResponse(feature="insights", content=content, live=ai_service.is_live())


@app.post(
    "/ai/translate",
    response_model=TranslateResponse,
    dependencies=[Depends(require_permission("ai:use"))],
)
def ai_translate(
    payload: TranslateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Translate text between English / Hindi / Kannada via Groq.

    Degrades gracefully: on quota/error it returns the original text with
    translated=False and an explanatory note, so the UI is never blocked.
    """
    result = ai_service.translate(
        payload.text, payload.target_lang, source_lang=payload.source_lang
    )
    if result["translated"]:
        log_ai_query(
            current_user=current_user,
            feature="translate",
            detail=f"-> {payload.target_lang}",
            request=request,
        )
    return TranslateResponse(text=result["text"], translated=result["translated"], note=result["note"])


@app.post("/ai/chat", dependencies=[Depends(require_permission("ai:use"))])
def ai_chat_stream(
    payload: AIChatRequest,
    request: Request,
    db: Session = Depends(get_readonly_db),
    current_user: User = Depends(get_current_user),
):
    """RAG-powered streaming chat — a real investigator assistant.

    Detects entities in the message (FIR numbers, FIR/case ids, districts,
    stations, suspect names), dynamically retrieves the matching records from
    PostgreSQL (FIR details, suspects, witnesses, evidence, timeline, related
    cases, assigned officers), and grounds the model in those records. Only when
    no concrete entity is found does it fall back to department analytics.

    The streamed answer is followed by a footer listing the data sources, FIR
    references, and a confidence score, so the assistant cites its grounding.
    """
    # Explicit fir_id (e.g. from a case page) takes priority; otherwise run RAG.
    if payload.fir_id:
        fir = db.query(FIR).filter(FIR.id == payload.fir_id).first()
        if fir:
            from ai_context import extract_fir_references

            context = "=== FIR " + fir.fir_number + " ===\n" + build_fir_context(db, fir)
            refs = extract_fir_references(db, fir)
            sources = refs["data_sources"]
            fir_references = refs["firs"]
            grounded = True
        else:
            context, sources, fir_references, grounded = "", [], [], False
    else:
        rag = ai_rag.retrieve(db, payload.message)
        context = rag.context
        sources = rag.sources
        fir_references = rag.fir_references
        grounded = rag.grounded

    # Grounded, record-backed questions get the full reasoning framework;
    # ungrounded/analytics questions get a lighter conversational answer.
    if grounded:
        prompt = (
            f"Investigator question: {payload.message}\n\n"
            "You are a crime intelligence decision-support system with direct access "
            "to CrimeAI records. First answer the investigator's question using ONLY "
            "the retrieved records below, then perform investigative ANALYSIS and "
            "REASONING over those records. Structure your response with these "
            "markdown sections (omit a section only if truly not applicable):\n\n"
            "## Case Summary\n(FIR, status, key facts)\n\n"
            "## AI Investigation Insights\n"
            "(Reasoned analysis: missing evidence, witness gaps, suspect risk "
            "assessment, similar-case insights. Apply the crime-specific "
            "investigative guidance provided in the records.)\n\n"
            "## Recommended Next Actions\n"
            "(Concrete, prioritised next steps the investigating officer should take.)\n\n"
            "## Risk Factors\n(Flight risk, escalation, repeat-offender signals, evidence loss.)\n\n"
            "## Evidence Trail\n(What evidence exists, what is missing, chain-of-custody notes.)\n\n"
            "Base every claim on the retrieved records. Where data is missing, state "
            "it explicitly and frame recommendations as investigative leads, not "
            "conclusions. Do not give legal advice.\n\n"
            f"--- RETRIEVED RECORDS ---\n{context}"
        )
    else:
        prompt = (
            f"Investigator question: {payload.message}\n\n"
            "You are a crime intelligence assistant. Answer using ONLY the context "
            "below; if it does not cover something, say so.\n\n"
            f"--- CONTEXT ---\n{context}"
        )

    # Confidence: high when grounded in specific FIR records, lower for
    # district-scoped lists, lowest for analytics-only fallback.
    if fir_references:
        confidence = 88
    elif grounded:
        confidence = 70
    else:
        confidence = 45

    detail = payload.message
    if fir_references:
        detail += f" [grounded: {', '.join(r['fir_number'] for r in fir_references)}]"
    log_ai_query(current_user=current_user, feature="chat", detail=detail, request=request)

    # Persist the user message (if a conversation is attached).
    if payload.conversation_id:
        _save_chat_message(payload.conversation_id, current_user.id, "user", payload.message)

    def event_stream():
        collected: list[str] = []
        for chunk in ai_service.generate_stream("chat", prompt):
            collected.append(chunk)
            yield chunk
        # Footer: data sources, FIR references, confidence.
        footer_lines = ["\n\n---"]
        if sources:
            footer_lines.append("**Data sources:** " + " · ".join(sources))
        if fir_references:
            footer_lines.append(
                "**FIR references:** " + ", ".join(r["fir_number"] for r in fir_references)
            )
        footer_lines.append(f"**Confidence:** {confidence}%")
        footer = "\n".join(footer_lines)
        yield footer

        # Persist the assistant message (answer + footer) after streaming.
        if payload.conversation_id:
            _save_chat_message(
                payload.conversation_id, current_user.id, "assistant", "".join(collected) + footer
            )

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")


# --- AI Conversation management (user-scoped, soft-delete) --------------------

def _owned_conversation(conv_id: int, user: User, db: Session, *, include_deleted: bool = False) -> AIConversation:
    """Fetch a conversation the current user owns, or 404. Enforces isolation."""
    query = db.query(AIConversation).filter(
        AIConversation.id == conv_id, AIConversation.user_id == user.id
    )
    if not include_deleted:
        query = query.filter(AIConversation.deleted_at.is_(None))
    conv = query.first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


def _conversation_summary(db: Session, conv: AIConversation) -> AIConversationSummary:
    count = db.query(func.count(AIMessage.id)).filter(AIMessage.conversation_id == conv.id).scalar() or 0
    last = (
        db.query(AIMessage.content)
        .filter(AIMessage.conversation_id == conv.id)
        .order_by(AIMessage.id.desc())
        .first()
    )
    preview = (last[0][:120] if last else None)
    return AIConversationSummary(
        id=conv.id,
        title=conv.title,
        pinned=conv.pinned,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        message_count=int(count),
        preview=preview,
    )


@app.get(
    "/ai/conversations",
    response_model=list[AIConversationSummary],
    dependencies=[Depends(require_permission("ai:use"))],
)
def list_conversations(
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List the current user's conversations (pinned first), with optional search
    over title and message content."""
    query = db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id, AIConversation.deleted_at.is_(None)
    )
    if search:
        pattern = f"%{search}%"
        # Match title OR any message content in the conversation.
        matching_conv_ids = (
            db.query(AIMessage.conversation_id)
            .filter(AIMessage.content.ilike(pattern))
            .distinct()
            .subquery()
        )
        query = query.filter(
            (AIConversation.title.ilike(pattern))
            | (AIConversation.id.in_(matching_conv_ids))
        )
    conversations = query.order_by(
        AIConversation.pinned.desc(), AIConversation.updated_at.desc()
    ).all()
    return [_conversation_summary(db, c) for c in conversations]


@app.post(
    "/ai/conversations",
    response_model=AIConversationDetail,
    dependencies=[Depends(require_permission("ai:use"))],
)
def create_conversation(
    payload: ConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = AIConversation(user_id=current_user.id, title=payload.title or "New conversation")
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return AIConversationDetail(
        id=conv.id, title=conv.title, pinned=conv.pinned,
        created_at=conv.created_at, updated_at=conv.updated_at, messages=[],
    )


@app.get(
    "/ai/conversations/{conv_id}",
    response_model=AIConversationDetail,
    dependencies=[Depends(require_permission("ai:use"))],
)
def get_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = _owned_conversation(conv_id, current_user, db)
    messages = (
        db.query(AIMessage)
        .filter(AIMessage.conversation_id == conv.id)
        .order_by(AIMessage.id.asc())
        .all()
    )
    return AIConversationDetail(
        id=conv.id, title=conv.title, pinned=conv.pinned,
        created_at=conv.created_at, updated_at=conv.updated_at, messages=messages,
    )


@app.patch(
    "/ai/conversations/{conv_id}/rename",
    response_model=AIConversationSummary,
    dependencies=[Depends(require_permission("ai:use"))],
)
def rename_conversation(
    conv_id: int,
    payload: ConversationRename,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = _owned_conversation(conv_id, current_user, db)
    conv.title = payload.title.strip()
    db.commit()
    db.refresh(conv)
    return _conversation_summary(db, conv)


@app.patch(
    "/ai/conversations/{conv_id}/pin",
    response_model=AIConversationSummary,
    dependencies=[Depends(require_permission("ai:use"))],
)
def pin_conversation(
    conv_id: int,
    payload: ConversationPin,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = _owned_conversation(conv_id, current_user, db)
    conv.pinned = payload.pinned
    db.commit()
    db.refresh(conv)
    return _conversation_summary(db, conv)


@app.delete(
    "/ai/conversations/{conv_id}",
    dependencies=[Depends(require_permission("ai:use"))],
)
def delete_conversation(
    conv_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a single conversation (audit-logged)."""
    conv = _owned_conversation(conv_id, current_user, db)
    conv.deleted_at = datetime.utcnow()
    create_audit_log(
        db=db,
        user_id=current_user.id,
        action="AI Chat Deleted",
        entity_type="ai_conversation",
        entity_id=conv.id,
        description=f"Conversation '{conv.title}' soft-deleted.",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    return {"message": "Conversation deleted", "id": conv_id}


@app.post(
    "/ai/conversations/bulk-delete",
    dependencies=[Depends(require_permission("ai:use"))],
)
def bulk_delete_conversations(
    payload: BulkDeleteRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete multiple conversations the user owns (audit-logged)."""
    convs = (
        db.query(AIConversation)
        .filter(
            AIConversation.user_id == current_user.id,
            AIConversation.id.in_(payload.ids),
            AIConversation.deleted_at.is_(None),
        )
        .all()
    )
    now = datetime.utcnow()
    for conv in convs:
        conv.deleted_at = now
    create_audit_log(
        db=db,
        user_id=current_user.id,
        action="AI Chat Bulk Deleted",
        entity_type="ai_conversation",
        description=f"{len(convs)} conversation(s) soft-deleted (bulk).",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    return {"message": "Conversations deleted", "count": len(convs)}


@app.post(
    "/ai/conversations/delete-all",
    dependencies=[Depends(require_permission("ai:use"))],
)
def delete_all_conversations(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete ALL of the user's conversations (audit-logged)."""
    convs = (
        db.query(AIConversation)
        .filter(AIConversation.user_id == current_user.id, AIConversation.deleted_at.is_(None))
        .all()
    )
    now = datetime.utcnow()
    for conv in convs:
        conv.deleted_at = now
    create_audit_log(
        db=db,
        user_id=current_user.id,
        action="AI Chat Delete All",
        entity_type="ai_conversation",
        description=f"All conversations soft-deleted ({len(convs)}).",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    return {"message": "All conversations deleted", "count": len(convs)}


# --- Criminal Network Analysis (read-only intelligence graph) -----------------

@app.get(
    "/network-analysis",
    response_model=NetworkGraphResponse,
    dependencies=[Depends(require_permission("network:view"))],
)
def network_analysis(
    crime_type: str | None = None,
    status_filter: str | None = None,
    district_id: int | None = None,
    suspect_id: int | None = None,
    fir_id: int | None = None,
    include_witness_evidence: bool = True,
    db: Session = Depends(get_readonly_db),
):
    """Build the scoped criminal network graph plus its analytics.

    Scope is anchored by a focus suspect or FIR if given, else by the filters
    (crime type / status / district). Node/edge counts are capped so the graph
    stays interpretable.
    """
    filters = {
        "crime_type": crime_type,
        "status": status_filter,
        "district_id": district_id,
        "suspect_id": suspect_id,
        "fir_id": fir_id,
    }
    graph = network_service.build_network(
        db, filters, include_witness_evidence=include_witness_evidence
    )
    return NetworkGraphResponse(
        nodes=[asdict(node) for node in graph.nodes],
        edges=[asdict(edge) for edge in graph.edges],
        stats=graph.stats,
        repeat_offenders=graph.repeat_offenders,
        most_connected=graph.most_connected,
        crime_groups=graph.crime_groups,
    )


@app.get(
    "/network-analysis/suspects",
    dependencies=[Depends(require_permission("network:view"))],
)
def network_search_suspects(q: str, db: Session = Depends(get_readonly_db)):
    """Search suspects by name/alias to anchor the graph on a focus suspect."""
    if not q or len(q) < 2:
        return []
    return network_service.search_suspects(db, q)


# --- Crime Hotspot Prediction (ML, read-only) --------------------------------

@app.get(
    "/hotspots",
    response_model=HotspotResponse,
    dependencies=[Depends(require_permission("analytics:view"))],
)
def crime_hotspots(db: Session = Depends(get_readonly_db)):
    """District risk scores (RandomForest), heatmap points, and monthly analysis."""
    result = hotspot_service.compute_hotspots(db)
    return HotspotResponse(
        heatmap=result.heatmap,
        risk_ranking=result.risk_ranking,
        monthly=result.monthly,
        kpis=result.kpis,
    )


@app.get(
    "/predictions",
    response_model=ForecastResponse,
    dependencies=[Depends(require_permission("analytics:view"))],
)
def crime_predictions(
    district: str | None = None,
    horizon: int = 6,
    model: str = "xgboost",
    db: Session = Depends(get_readonly_db),
):
    """Crime trend forecast (XGBoost or RandomForest) for the state or a district."""
    horizon = min(max(horizon, 1), 12)
    if model not in {"xgboost", "random_forest"}:
        model = "xgboost"
    result = hotspot_service.forecast(db, district=district, horizon=horizon, model_name=model)
    return ForecastResponse(
        history=result.history,
        forecast=result.forecast,
        model=result.model,
        district=result.district,
    )


# --- Similar Case Intelligence (TF-IDF + cosine, read-only) ------------------

@app.get(
    "/similar-cases/{fir_id}",
    response_model=SimilarCasesResponse,
    dependencies=[Depends(require_permission("fir:view"))],
)
def similar_cases(fir_id: int, limit: int = 10, db: Session = Depends(get_readonly_db)):
    """Find FIRs most similar to the given one (modus operandi, location,
    crime type, shared suspects), with outcome comparison and a recommendation."""
    limit = min(max(limit, 1), 25)
    result = similar_cases_service.find_similar(db, fir_id, limit=limit)
    if result is None:
        raise HTTPException(status_code=404, detail="FIR not found")

    return SimilarCasesResponse(
        target=result.target,
        similar=[
            SimilarCaseItem(
                fir_id=c.fir_id,
                fir_number=c.fir_number,
                crime_type=c.crime_type,
                status=c.status,
                district=c.district,
                incident_date=c.incident_date,
                description=c.description,
                similarity=c.similarity,
                breakdown=c.breakdown,
                shared_suspects=c.shared_suspects,
            )
            for c in result.similar
        ],
        outcome_distribution=result.outcome_distribution,
        recommendation=result.recommendation,
    )


# --- Sociological Crime Intelligence (read-only) -----------------------------

@app.get(
    "/sociology",
    response_model=SociologyResponse,
    dependencies=[Depends(require_permission("analytics:view"))],
)
def sociology_dashboard(db: Session = Depends(get_readonly_db)):
    """Demographic crime analysis: age/gender/occupation/education/income,
    youth & gender trends, social risk factors, migration impact, economic
    stress, and an age x crime-type correlation matrix."""
    ov = sociology_service.overview(db)
    return SociologyResponse(
        kpis=ov.kpis,
        age_distribution=ov.age_distribution,
        gender=ov.gender,
        education=ov.education,
        occupation=ov.occupation,
        income_band=ov.income_band,
        employment=ov.employment,
        youth_crime=sociology_service.youth_crime_trends(db),
        gender_crime=sociology_service.gender_crime_trends(db),
        risk_factors=sociology_service.social_risk_factors(db),
        migration=sociology_service.migration_impact(db),
        economic_stress=sociology_service.economic_stress(db),
        age_crime_correlation=sociology_service.age_crime_correlation(db),
    )


@app.get("/firs/{fir_id}", response_model=FIRResponse, dependencies=[Depends(require_permission("fir:view"))])
def get_fir(fir_id: int, db: Session = Depends(get_db)):
    return get_fir_or_404(fir_id, db)


@app.get(
    "/firs/{fir_id}/case",
    response_model=FIRDetailResponse,
    dependencies=[Depends(require_permission("fir:view"))],
)
def get_case_detail(fir_id: int, db: Session = Depends(get_db)):
    fir = get_fir_or_404(fir_id, db)
    return build_case_detail(fir, db)


@app.put("/firs/{fir_id}", dependencies=[Depends(require_permission("fir:update"))])
def update_fir(
    fir_id: int,
    fir: FIRCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing_fir = get_fir_or_404(fir_id, db)
    previous_status = existing_fir.status

    for field, value in fir.model_dump().items():
        setattr(existing_fir, field, value)

    create_audit_log(
        db=db,
        fir_id=existing_fir.id,
        action="FIR Updated",
        entity_type="fir",
        entity_id=existing_fir.id,
        description=f"FIR details updated for {existing_fir.fir_number}.",
        performed_by=current_user.id,
    )

    if previous_status != existing_fir.status:
        create_audit_log(
            db=db,
            fir_id=existing_fir.id,
            action="Status Changed",
            entity_type="fir",
            entity_id=existing_fir.id,
            description=f"Status changed from {previous_status} to {existing_fir.status}.",
            performed_by=current_user.id,
        )

    db.commit()
    db.refresh(existing_fir)
    return {"message": "FIR Updated", "id": existing_fir.id}


@app.patch("/firs/{fir_id}/status", dependencies=[Depends(require_permission("fir:update"))])
def update_fir_status(
    fir_id: int,
    payload: FIRStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fir = get_fir_or_404(fir_id, db)
    previous_status = fir.status
    fir.status = payload.status

    create_audit_log(
        db=db,
        fir_id=fir.id,
        action="Status Changed",
        entity_type="fir",
        entity_id=fir.id,
        description=f"Status changed from {previous_status} to {fir.status}.",
        performed_by=current_user.id,
    )

    db.commit()
    db.refresh(fir)
    return {"message": "Status updated", "id": fir.id, "status": fir.status}


@app.delete("/firs/{fir_id}", dependencies=[Depends(require_permission("fir:delete"))])
def delete_fir(fir_id: int, db: Session = Depends(get_db)):
    fir = get_fir_or_404(fir_id, db)
    db.delete(fir)
    db.commit()
    return {"message": "Deleted successfully"}


@app.post(
    "/firs/{fir_id}/evidence",
    response_model=list[EvidenceResponse],
    dependencies=[Depends(require_permission("fir:update"))],
)
def upload_evidence(
    fir_id: int,
    media_type: str = Form("auto"),
    description: str | None = Form(None),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    request: Request = None,
):
    """Upload one or more evidence files for an FIR.

    The media type is auto-classified from each file's content-type (image /
    video / pdf / audio / document) unless a specific type is provided. Each
    file is size-validated, stored via the storage backend, and audit-logged.
    """
    fir = get_fir_or_404(fir_id, db)

    explicit_type = media_type if media_type in EVIDENCE_MEDIA_TYPES else None
    evidence_items: list[Evidence] = []

    for file in files:
        size = read_upload_size(file)
        resolved_type = explicit_type or classify_evidence_media_type(
            file.content_type or "", file.filename or ""
        )
        key, content_type = save_upload_file(file, resolved_type, fir.id)
        evidence = Evidence(
            fir_id=fir.id,
            file_name=file.filename or "attachment",
            file_type=content_type,
            media_type=resolved_type,
            file_path=key,
            file_size=size,
            description=description,
            uploaded_by=current_user.id,
        )
        db.add(evidence)
        db.flush()
        create_audit_log(
            db=db,
            fir_id=fir.id,
            action="Evidence Uploads",
            entity_type="evidence",
            entity_id=evidence.id,
            description=f"Evidence '{evidence.file_name}' ({resolved_type}, {size} bytes) uploaded.",
            performed_by=current_user.id,
            ip_address=get_client_ip(request),
        )
        evidence_items.append(evidence)

    db.commit()
    for item in evidence_items:
        db.refresh(item)

    return [evidence_to_response(item) for item in evidence_items]


@app.get(
    "/firs/{fir_id}/evidence",
    response_model=list[EvidenceResponse],
    dependencies=[Depends(require_permission("fir:view"))],
)
def list_evidence(
    fir_id: int,
    search: str | None = None,
    media_type: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    """List evidence for an FIR with search, type, and date-range filters."""
    get_fir_or_404(fir_id, db)
    query = db.query(Evidence).filter(Evidence.fir_id == fir_id)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Evidence.file_name.ilike(pattern)) | (Evidence.description.ilike(pattern))
        )
    if media_type and media_type in EVIDENCE_MEDIA_TYPES:
        query = query.filter(Evidence.media_type == media_type)
    if date_from:
        query = query.filter(Evidence.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Evidence.created_at <= datetime.combine(date_to, datetime.max.time()))

    items = query.order_by(Evidence.created_at.desc()).all()
    return [evidence_to_response(item) for item in items]


@app.get(
    "/firs/{fir_id}/evidence/count",
    response_model=EvidenceCountResponse,
    dependencies=[Depends(require_permission("fir:view"))],
)
def evidence_count(fir_id: int, db: Session = Depends(get_db)):
    """Total evidence count for an FIR plus a per-type breakdown."""
    get_fir_or_404(fir_id, db)
    rows = (
        db.query(Evidence.media_type, func.count(Evidence.id))
        .filter(Evidence.fir_id == fir_id)
        .group_by(Evidence.media_type)
        .all()
    )
    by_type = {media_type: count for media_type, count in rows}
    return EvidenceCountResponse(fir_id=fir_id, total=sum(by_type.values()), by_type=by_type)


@app.get(
    "/evidence/{evidence_id}/download",
    dependencies=[Depends(require_permission("fir:view"))],
)
def download_evidence(evidence_id: int, db: Session = Depends(get_db)):
    """Stream an evidence file as an attachment download."""
    item = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Evidence not found")

    storage = get_storage()
    if not storage.exists(item.file_path):
        raise HTTPException(status_code=404, detail="Evidence file is missing from storage")

    file_obj = storage.open(item.file_path)
    headers = {"Content-Disposition": f'attachment; filename="{item.file_name}"'}
    return StreamingResponse(file_obj, media_type=item.file_type, headers=headers)


@app.delete(
    "/evidence/{evidence_id}",
    dependencies=[Depends(require_permission("fir:delete"))],
)
def delete_evidence(
    evidence_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an evidence record and remove the underlying file."""
    item = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Evidence not found")

    fir_id = item.fir_id
    file_name = item.file_name
    get_storage().delete(item.file_path)
    db.delete(item)
    create_audit_log(
        db=db,
        fir_id=fir_id,
        action="Evidence Deleted",
        entity_type="evidence",
        entity_id=evidence_id,
        description=f"Evidence '{file_name}' deleted.",
        performed_by=current_user.id,
        ip_address=get_client_ip(request),
    )
    db.commit()
    return {"message": "Evidence deleted", "id": evidence_id}


@app.post(
    "/firs/{fir_id}/witnesses",
    response_model=WitnessResponse,
    dependencies=[Depends(require_permission("fir:update"))],
)
def add_witness(
    fir_id: int,
    payload: WitnessCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fir = get_fir_or_404(fir_id, db)
    witness = Witness(fir_id=fir.id, **payload.model_dump())
    db.add(witness)
    db.flush()
    create_audit_log(
        db=db,
        fir_id=fir.id,
        action="Witness Added",
        entity_type="witness",
        entity_id=witness.id,
        description=f"Witness {witness.name} added to the case.",
        performed_by=current_user.id,
    )
    db.commit()
    db.refresh(witness)
    return WitnessResponse.model_validate(witness)


@app.put(
    "/firs/{fir_id}/witnesses/{witness_id}",
    response_model=WitnessResponse,
    dependencies=[Depends(require_permission("fir:update"))],
)
def update_witness(
    fir_id: int,
    witness_id: int,
    payload: WitnessUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    get_fir_or_404(fir_id, db)
    witness = db.query(Witness).filter(Witness.id == witness_id, Witness.fir_id == fir_id).first()
    if not witness:
        raise HTTPException(status_code=404, detail="Witness not found")

    for field, value in payload.model_dump().items():
        setattr(witness, field, value)

    create_audit_log(
        db=db,
        fir_id=fir_id,
        action="Witness Updated",
        entity_type="witness",
        entity_id=witness.id,
        description=f"Witness {witness.name} updated.",
        performed_by=current_user.id,
    )
    db.commit()
    db.refresh(witness)
    return WitnessResponse.model_validate(witness)


@app.post(
    "/firs/{fir_id}/suspects",
    response_model=SuspectResponse,
    dependencies=[Depends(require_permission("fir:update"))],
)
def add_suspect_to_fir(
    fir_id: int,
    payload: SuspectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fir = get_fir_or_404(fir_id, db)
    suspect = Suspect(**payload.model_dump())
    db.add(suspect)
    db.flush()

    link = FIRSuspect(fir_id=fir.id, suspect_id=suspect.id)
    db.add(link)
    db.flush()

    create_audit_log(
        db=db,
        fir_id=fir.id,
        action="Suspect Linked",
        entity_type="suspect",
        entity_id=suspect.id,
        description=f"Suspect {suspect.name} linked to the case.",
        performed_by=current_user.id,
    )
    db.commit()
    db.refresh(suspect)
    return SuspectResponse.model_validate(suspect)


@app.post(
    "/firs/{fir_id}/suspects/{suspect_id}",
    response_model=SuspectResponse,
    dependencies=[Depends(require_permission("fir:update"))],
)
def link_existing_suspect(
    fir_id: int,
    suspect_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fir = get_fir_or_404(fir_id, db)
    suspect = db.query(Suspect).filter(Suspect.id == suspect_id).first()
    if not suspect:
        raise HTTPException(status_code=404, detail="Suspect not found")

    existing_link = (
        db.query(FIRSuspect)
        .filter(FIRSuspect.fir_id == fir.id, FIRSuspect.suspect_id == suspect.id)
        .first()
    )
    if existing_link:
        raise HTTPException(status_code=409, detail="Suspect already linked to this FIR")

    db.add(FIRSuspect(fir_id=fir.id, suspect_id=suspect.id))
    create_audit_log(
        db=db,
        fir_id=fir.id,
        action="Suspect Linked",
        entity_type="suspect",
        entity_id=suspect.id,
        description=f"Existing suspect {suspect.name} linked to the case.",
        performed_by=current_user.id,
    )
    db.commit()
    db.refresh(suspect)
    return SuspectResponse.model_validate(suspect)


@app.get("/suspects", response_model=list[SuspectResponse], dependencies=[Depends(require_permission("fir:view"))])
def get_suspects(db: Session = Depends(get_db)):
    suspects = db.query(Suspect).order_by(Suspect.created_at.desc()).all()
    return [SuspectResponse.model_validate(item) for item in suspects]


@app.get("/dashboard/stats", dependencies=[Depends(require_permission("dashboard:view"))])
def dashboard_stats(db: Session = Depends(get_db)):
    return {
        "total_firs": db.query(FIR).count(),
        "open_cases": db.query(FIR).filter(FIR.status != "Closed").count(),
        "closed_cases": db.query(FIR).filter(FIR.status == "Closed").count(),
        "districts": db.query(District).count(),
        "police_stations": db.query(PoliceStation).count(),
        "users": db.query(User).count(),
    }


@app.get("/districts", dependencies=[Depends(require_permission("fir:view"))])
def get_districts(db: Session = Depends(get_db)):
    return db.query(District).all()


@app.get("/police-stations", dependencies=[Depends(require_permission("fir:view"))])
def get_police_stations(db: Session = Depends(get_db)):
    return db.query(PoliceStation).all()


@app.get("/districts/{district_id}/stations", dependencies=[Depends(require_permission("fir:view"))])
def get_stations_by_district(district_id: int, db: Session = Depends(get_db)):
    return db.query(PoliceStation).filter(PoliceStation.district_id == district_id).all()


@app.get("/dashboard/cards", dependencies=[Depends(require_permission("dashboard:view"))])
def dashboard_cards(db: Session = Depends(get_db)):
    return [
        {"title": "Total FIRs", "value": db.query(FIR).count()},
        {"title": "Open Cases", "value": db.query(FIR).filter(FIR.status != "Closed").count()},
        {"title": "Users", "value": db.query(User).count()},
    ]
