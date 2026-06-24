from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from database import Base


class FIR(Base):
    __tablename__ = "firs"

    id = Column(Integer, primary_key=True, index=True)
    fir_number = Column(String, unique=True, nullable=False)
    crime_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    district_id = Column(Integer, nullable=False)
    police_station_id = Column(Integer, nullable=False)
    incident_date = Column(Date, nullable=False)
    status = Column(String, nullable=False)

    evidence_items = relationship("Evidence", back_populates="fir", cascade="all, delete-orphan")
    witnesses = relationship("Witness", back_populates="fir", cascade="all, delete-orphan")
    suspect_links = relationship("FIRSuspect", back_populates="fir", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="fir", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)

    users = relationship("User", back_populates="role_ref")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    employee_id = Column(String, unique=True, index=True, nullable=True)
    mobile_number = Column(String, nullable=True)
    rank = Column(String, nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    station_id = Column(Integer, ForeignKey("police_stations.id"), nullable=True)
    status = Column(String, nullable=False, default="Pending")
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    role_ref = relationship("Role", back_populates="users")


class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)


class PoliceStation(Base):
    __tablename__ = "police_stations"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, nullable=False)
    name = Column(String, nullable=False)


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    fir_id = Column(Integer, ForeignKey("firs.id"), nullable=False, index=True)
    file_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    # Logical category: image | video | pdf | audio | document
    media_type = Column(String, nullable=False)
    # Storage key (LocalStorage path / future S3 object key).
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    fir = relationship("FIR", back_populates="evidence_items")


class Witness(Base):
    __tablename__ = "witnesses"

    id = Column(Integer, primary_key=True, index=True)
    fir_id = Column(Integer, ForeignKey("firs.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    contact_number = Column(String, nullable=False)
    statement = Column(Text, nullable=False)
    address = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    fir = relationship("FIR", back_populates="witnesses")


class Suspect(Base):
    __tablename__ = "suspects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    alias = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    # Sociological / demographic attributes (backfilled synthetically).
    gender = Column(String, nullable=True)            # Male | Female | Other
    occupation = Column(String, nullable=True)
    education = Column(String, nullable=True)         # None | Primary | Secondary | Graduate | Postgraduate
    income_band = Column(String, nullable=True)       # Low | Lower-Middle | Middle | Upper-Middle | High
    employment_status = Column(String, nullable=True) # Employed | Unemployed | Self-employed | Student
    is_migrant = Column(Boolean, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    fir_links = relationship("FIRSuspect", back_populates="suspect", cascade="all, delete-orphan")


class FIRSuspect(Base):
    __tablename__ = "fir_suspects"

    id = Column(Integer, primary_key=True, index=True)
    fir_id = Column(Integer, ForeignKey("firs.id"), nullable=False, index=True)
    suspect_id = Column(Integer, ForeignKey("suspects.id"), nullable=False, index=True)
    linked_at = Column(DateTime, server_default=func.now())

    fir = relationship("FIR", back_populates="suspect_links")
    suspect = relationship("Suspect", back_populates="fir_links")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    fir_id = Column(Integer, ForeignKey("firs.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(Integer, nullable=True)
    description = Column(Text, nullable=False)
    performed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    fir = relationship("FIR", back_populates="audit_logs")


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="Pending")
    requested_role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    requested_district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    requested_station_id = Column(Integer, ForeignKey("police_stations.id"), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    refresh_token_hash = Column(String, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False, default="New conversation")
    pinned = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime, nullable=True)  # soft delete
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    messages = relationship(
        "AIMessage", back_populates="conversation", cascade="all, delete-orphan"
    )


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer, ForeignKey("ai_conversations.id"), nullable=False, index=True
    )
    role = Column(String, nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    conversation = relationship("AIConversation", back_populates="messages")
