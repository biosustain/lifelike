import os
from flask import (
    Blueprint,
    g,
    jsonify,
    make_response,
    request,
)
from flask.views import MethodView
from neo4japp.exceptions import FileUploadError
from neo4japp.blueprints.auth import auth
from neo4japp.blueprints.permissions import requires_role


bp = Blueprint('storage', __name__, url_prefix='/storage')


# class UserManualAPI(MethodView):
#     """ Uploads a user manual for how to use Lifelike. This API is Google Cloud
#     platform specific and will need a service account to operate. The service account
#     has to be available within the Docker container and the file's path has to be referenced
#     by an environmental variable for this to function.

#     See: https://cloud.google.com/storage/docs/reference/libraries#setting_up_authentication
#     """

#     USER_MANUAL_FILENAME = 'lifelike-user-manual'
#     GCP_STORAGE_BUCKET = 'lifelike-manual'

#     storage_client = storage.Client()
#     bucket = storage_client.get_bucket(GCP_STORAGE_BUCKET)
#     blob = bucket.blob(USER_MANUAL_FILENAME)

#     @auth.login_required
#     def get(self):
#         file_content = self.blob.download_as_bytes()
#         resp = make_response(file_content)
#     resp.headers['Content-Disposition'] = f'attachment;filename={self.USER_MANUAL_FILENAME}.pdf'
#         resp.headers['Content-Type'] = 'application/pdf'
#         return resp

#     @auth.login_required
#     @requires_role('admin')
#     def post(self):
#         yield g.current_user

#         try:
#             file = request.files['file']
#         except KeyError:
#             raise FileUploadError('No file specified.')

#         self.blob.upload_from_string(file.read(), content_type='application/pdf')

#         yield jsonify(dict(results='Manual successfully uploaded.'))


# bp.add_url_rule('manual', view_func=UserManualAPI.as_view('admin_manual'))
