import os
import pytest
import json


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_user_can_get_gene_annotations_from_pdf(
        client,
        test_user_with_pdf,
        fix_project,
        fix_api_owner,
        mock_get_combined_annotations_result,
        mock_get_organisms_from_gene_ids_result,
):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id

    response = client.get(
        f'/annotations/{fix_project.project_name}/{file_id}/genes',
        headers=headers,
        content_type='application/json',
    )
    assert response.status_code == 200
    assert response.get_data() == \
        b'gene_id\tgene_name\torganism_id\torganism_name\tgene_annotation_count\n' +  \
        b'59272\tACE2\t9606\tHomo sapiens\t1\n'


def test_user_can_get_all_annotations_from_pdf(
        client,
        test_user_with_pdf,
        fix_project,
        fix_api_owner,
        mock_get_combined_annotations_result,
):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.file_id

    response = client.get(
        f'/annotations/{fix_project.project_name}/{file_id}',
        headers=headers,
        content_type='application/json',
    )
    assert response.status_code == 200
    assert response.get_data() == \
        b'entity_id\ttype\ttext\tcount\n' + \
        b'59272\tGene\tace2\t1\n' + \
        b'9606\tSpecies\thuman\t1\n'
