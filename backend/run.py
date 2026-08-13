"""仅用于本地开发；生产环境请使用 Gunicorn/容器。"""
from app import create_app

app = create_app()
settings = app.extensions["settings"]

if __name__ == "__main__":
    app.run(host=settings.host, port=settings.port, debug=False)
