from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI(title="ClaudePad")

# Paths
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Templates
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@app.get("/")
async def index(request: Request):
    """Redirect to current project or show project selector."""
    return templates.TemplateResponse("index.html", {
        "request": request,
        "project": None,
        "tasks": []
    })


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


def run_server():
    """Entry point for uv run claudpad."""
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)


if __name__ == "__main__":
    run_server()
