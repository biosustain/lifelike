import os

from datetime import timezone

REQUEST_TIMEOUT = int(os.getenv('SERVICE_REQUEST_TIMEOUT', '60'))
TIMEZONE = timezone.utc
