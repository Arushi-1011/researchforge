"""Standard API error envelope."""
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse


async def validation_error_handler(request, exc):
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"detail": exc.errors()}),
    )