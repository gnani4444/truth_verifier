from pydantic import BaseModel


class VerifyRequest(BaseModel):
    url: str
    use_vision: bool = False


class VerifyResponse(BaseModel):
    job_id: str
