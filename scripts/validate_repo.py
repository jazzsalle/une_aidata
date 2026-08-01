#!/usr/bin/env python3
"""Deprecated compatibility entrypoint. Source v1.5.1 official validator is validate_vercel_repo.py."""
from pathlib import Path
import runpy
print('[DEPRECATED] scripts/validate_repo.py -> scripts/validate_vercel_repo.py')
runpy.run_path(str(Path(__file__).with_name('validate_vercel_repo.py')), run_name='__main__')
