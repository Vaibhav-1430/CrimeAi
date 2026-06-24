from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

RoleName = Literal[
    "SuperAdmin",
    "StateAdmin",
    "DistrictAdmin",
    "StationOfficer",
    "Investigator",
    "Analyst",
]
UserStatus = Literal["Pending", "Approved", "Rejected", "Suspended"]
FIRStatus = Literal["Open", "Under Investigation", "Chargesheet Filed", "Closed"]
EvidenceMediaType = Literal["image", "video", "pdf", "audio", "document"]


class FIRCreate(BaseModel):
    fir_number: str
    crime_type: str
    description: str
    district_id: int
    police_station_id: int
    incident_date: date
    status: FIRStatus


class FIRResponse(BaseModel):
    id: int
    fir_number: str
    crime_type: str
    description: str
    district_id: int
    police_station_id: int
    incident_date: date
    status: FIRStatus

    class Config:
        from_attributes = True


class PaginatedFIRResponse(BaseModel):
    items: list[FIRResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class NamedCount(BaseModel):
    name: str
    count: int


class MonthlyStat(BaseModel):
    month: str
    total: int
    open: int
    closed: int


class AnalyticsSummary(BaseModel):
    total_firs: int
    open_cases: int
    closed_cases: int
    crime_type_count: int
    district_stats: list[NamedCount]
    crime_type_stats: list[NamedCount]
    status_stats: list[NamedCount]
    monthly_stats: list[MonthlyStat]


class UserCreate(BaseModel):
    name: str = Field(min_length=2)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8)
    role: RoleName


class OfficerSignupRequest(BaseModel):
    name: str = Field(min_length=2)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    employee_id: str = Field(min_length=2)
    mobile_number: str = Field(min_length=8)
    rank: str = Field(min_length=2)
    district_id: int
    station_id: int
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    employee_id: str | None = None
    mobile_number: str | None = None
    rank: str | None = None
    role: RoleName
    role_id: int | None = None
    district_id: int | None = None
    station_id: int | None = None
    status: UserStatus = "Pending"
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class OfficerSignupResponse(BaseModel):
    message: str
    status: UserStatus


class RoleResponse(BaseModel):
    id: int
    name: RoleName

    class Config:
        from_attributes = True


class ApprovalRequestResponse(BaseModel):
    id: int
    user_id: int
    status: UserStatus
    requested_role_id: int | None
    requested_district_id: int | None
    requested_station_id: int | None
    reviewed_by: int | None
    reviewed_at: datetime | None
    rejection_reason: str | None
    created_at: datetime
    user: UserResponse


class ApprovalDecision(BaseModel):
    role_id: int
    district_id: int
    station_id: int


class RejectionDecision(BaseModel):
    reason: str = Field(min_length=3)


class UserUpdate(BaseModel):
    name: str = Field(min_length=2)
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    employee_id: str = Field(min_length=2)
    mobile_number: str = Field(min_length=8)
    rank: str = Field(min_length=2)
    role_id: int
    district_id: int | None = None
    station_id: int | None = None
    status: UserStatus


class ChangeRoleRequest(BaseModel):
    role_id: int


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=8)


class WitnessCreate(BaseModel):
    name: str = Field(min_length=2)
    contact_number: str = Field(min_length=5)
    statement: str = Field(min_length=5)
    address: str = Field(min_length=5)


class WitnessUpdate(BaseModel):
    name: str = Field(min_length=2)
    contact_number: str = Field(min_length=5)
    statement: str = Field(min_length=5)
    address: str = Field(min_length=5)


class WitnessResponse(BaseModel):
    id: int
    fir_id: int
    name: str
    contact_number: str
    statement: str
    address: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SuspectCreate(BaseModel):
    name: str = Field(min_length=2)
    alias: str | None = None
    age: int | None = Field(default=None, ge=0, le=120)
    notes: str | None = None


class SuspectResponse(BaseModel):
    id: int
    name: str
    alias: str | None
    age: int | None
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class EvidenceResponse(BaseModel):
    id: int
    fir_id: int
    file_name: str
    file_type: str
    media_type: EvidenceMediaType
    file_path: str
    file_url: str | None = None
    file_size: int | None = None
    description: str | None = None
    uploaded_by: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class EvidenceCountResponse(BaseModel):
    fir_id: int
    total: int
    by_type: dict[str, int]


class AuditLogResponse(BaseModel):
    id: int
    fir_id: int | None
    user_id: int | None = None
    action: str
    entity_type: str
    entity_id: int | None
    description: str
    performed_by: int | None
    ip_address: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListItem(BaseModel):
    """Audit row enriched with the actor's name/role, joined at query time.

    Names/roles are resolved from the users table rather than denormalized onto
    the log, so historical rows stay immutable and never carry stale values.
    """

    id: int
    user_id: int | None = None
    user_name: str | None = None
    role: str | None = None
    action: str
    entity_type: str
    entity_id: int | None = None
    description: str
    ip_address: str | None = None
    created_at: datetime


class PaginatedAuditLogs(BaseModel):
    items: list[AuditLogListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class AuditFilterOptions(BaseModel):
    actions: list[str]
    entity_types: list[str]
    roles: list[str]


class AIChatRequest(BaseModel):
    message: str
    fir_id: int | None = None
    conversation_id: int | None = None


class AIMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class AIConversationSummary(BaseModel):
    id: int
    title: str
    pinned: bool
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    preview: str | None = None


class AIConversationDetail(BaseModel):
    id: int
    title: str
    pinned: bool
    created_at: datetime
    updated_at: datetime
    messages: list[AIMessageResponse]


class ConversationCreate(BaseModel):
    title: str | None = None


class ConversationRename(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ConversationPin(BaseModel):
    pinned: bool


class BulkDeleteRequest(BaseModel):
    ids: list[int]


class TranslateRequest(BaseModel):
    text: str
    target_lang: Literal["en", "hi", "kn"]
    source_lang: Literal["en", "hi", "kn"] | None = None


class TranslateResponse(BaseModel):
    text: str
    translated: bool
    note: str = ""


class AIQuestionRequest(BaseModel):
    fir_id: int
    question: str | None = None


class AIReportRequest(BaseModel):
    fir_id: int
    report_type: Literal["investigation", "daily_briefing", "case_summary"] = "investigation"


class AISearchRequest(BaseModel):
    query: str


class AISearchResult(BaseModel):
    interpreted_filters: dict
    explanation: str
    results: list[FIRResponse]


class AITextResponse(BaseModel):
    feature: str
    content: str
    live: bool


class ExplainabilityReferences(BaseModel):
    firs: list[dict] = []
    evidence: list[dict] = []
    suspects: list[dict] = []
    witnesses: list[dict] = []
    data_sources: list[str] = []


class AIExplainRequest(BaseModel):
    fir_id: int
    question: str | None = None


class AIExplainResponse(BaseModel):
    feature: str
    live: bool
    answer: str
    recommendation: str
    reasoning_chain: list[str]
    confidence: float
    confidence_rationale: str
    references: ExplainabilityReferences


class SociologyResponse(BaseModel):
    kpis: dict
    age_distribution: list[dict]
    gender: list[dict]
    education: list[dict]
    occupation: list[dict]
    income_band: list[dict]
    employment: list[dict]
    youth_crime: dict
    gender_crime: dict
    risk_factors: dict
    migration: dict
    economic_stress: dict
    age_crime_correlation: dict


class SimilarCaseItem(BaseModel):
    fir_id: int
    fir_number: str
    crime_type: str
    status: str
    district: str
    incident_date: str
    description: str
    similarity: float
    breakdown: dict
    shared_suspects: list[str]


class SimilarCasesResponse(BaseModel):
    target: dict
    similar: list[SimilarCaseItem]
    outcome_distribution: dict
    recommendation: str


class HotspotResponse(BaseModel):
    heatmap: list[dict]
    risk_ranking: list[dict]
    monthly: list[dict]
    kpis: dict


class ForecastResponse(BaseModel):
    history: list[dict]
    forecast: list[dict]
    model: str
    district: str | None = None


class GraphNodeSchema(BaseModel):
    id: str
    type: str
    label: str
    meta: dict = {}


class GraphEdgeSchema(BaseModel):
    id: str
    source: str
    target: str
    type: str


class NetworkGraphResponse(BaseModel):
    nodes: list[GraphNodeSchema]
    edges: list[GraphEdgeSchema]
    stats: dict
    repeat_offenders: list[dict]
    most_connected: list[dict]
    crime_groups: list[dict]


class FIRDetailResponse(BaseModel):
    fir: FIRResponse
    evidence: list[EvidenceResponse]
    witnesses: list[WitnessResponse]
    suspects: list[SuspectResponse]
    audit_logs: list[AuditLogResponse]


class FIRStatusUpdate(BaseModel):
    status: FIRStatus
