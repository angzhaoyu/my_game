"""Application package.

The factory import is lazy so pure domain tests can run without Flask/PyMySQL installed.
"""


def create_app(*args, **kwargs):
    from .factory import create_app as factory
    return factory(*args, **kwargs)


__all__ = ["create_app"]
