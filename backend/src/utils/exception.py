"""
utils/exception.py — Exceptions métier & gestionnaire global SIGEP-DPE Backend
Centralise les exceptions personnalisées et les handlers FastAPI.
"""
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse

from src.utils.logger import get_logger

logger = get_logger(__name__)


class SIGEPException(Exception):
    """Exception racine du domaine SIGEP-DPE."""

    def __init__(self, message: str, status_code: int = 500, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class NotFoundError(SIGEPException):
    def __init__(self, resource: str, resource_id: str = ""):
        super().__init__(
            message=f"{resource} non trouvé" + (f" (id={resource_id})" if resource_id else ""),
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ValidationError(SIGEPException):
    def __init__(self, message: str, field: str = ""):
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"field": field} if field else {},
        )


class AuthError(SIGEPException):
    def __init__(self, message: str = "Authentification requise"):
        super().__init__(message, status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenError(SIGEPException):
    def __init__(self, message: str = "Accès interdit"):
        super().__init__(message, status_code=status.HTTP_403_FORBIDDEN)


# ── Handler global pour FastAPI ──
async def sigep_exception_handler(request: Request, exc: SIGEPException) -> JSONResponse:
    logger.error("Exception SIGEP", path=request.url.path, status=exc.status_code, message=exc.message)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.message, "details": exc.details, "path": str(request.url.path)},
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Exception inattendue", path=request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Erreur interne du serveur", "path": str(request.url.path)},
    )
