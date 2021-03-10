from flask import (
    Blueprint,
    g,
    jsonify,
    make_response,
    request
)
from flask.globals import current_app
from flask.views import MethodView
from neo4japp.exceptions import FileUploadError, NotAuthorizedException
from neo4japp.blueprints.auth import auth
from azure.storage.blob import BlobType, BlobServiceClient, ContentSettings


bp = Blueprint('storage', __name__, url_prefix='/storage')


class UserManualAPI(MethodView):

    decorators = [auth.login_required]

    USER_MANUAL_FILENAME = '***ARANGO_DB_NAME***-user-manual'

    def get_blob_service(self):
        storage_client = BlobServiceClient(
            current_app.config.get('AZURE_BLOB_STORAGE_URL'),
            current_app.config.get('AZURE_ACCOUNT_STORAGE_KEY'))
        container_client = storage_client.get_container_client('***ARANGO_DB_NAME***-manual')
        blob_client = container_client.get_blob_client(f'{self.USER_MANUAL_FILENAME}.pdf')
        return blob_client

    def get(self):
        bc = self.get_blob_service()
        file_stream = bc.download_blob()
        resp = make_response(file_stream.readall())
        resp.headers['Content-Disposition'] = f'attachment;filename={self.USER_MANUAL_FILENAME}.pdf'
        resp.headers['Content-Type'] = 'application/pdf'
        return resp

    def post(self):
        if g.current_user.has_role('admin') or g.current_user.has_role('private-data-access'):
            try:
                file = request.files['file']
            except KeyError:
                raise FileUploadError('No file specified.')
            bc = self.get_blob_service()
            bc.upload_blob(
                file.read(),
                blob_type=BlobType.BlockBlob,
                content_settings=ContentSettings(content_type='application/pdf'),
                overwrite=True)
            return jsonify(dict(results='Manual successfully uploaded.'))
        raise NotAuthorizedException('You do not have sufficient privileges')


bp.add_url_rule('manual', view_func=UserManualAPI.as_view('admin_manual'))
