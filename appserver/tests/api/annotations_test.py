import logging
import os
import pytest
import json

from neo4japp.models import Files, Projects, AppUser


def generate_headers(jwt_token):
    return {'Authorization': f'Bearer {jwt_token}'}


def test_user_can_get_gene_annotations_from_pdf(
        client,
        test_user_with_pdf: Files,
        fix_api_owner: AppUser,
        mock_get_combined_annotations_result,
        mock_get_organisms_from_gene_ids_result,
):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.hash_id

    response = client.post(
        f'/filesystem/objects/{file_id}/annotations/gene-counts',
        headers=headers,
        content_type='application/json',
    )
    assert response.status_code == 200
    assert response.get_data() == \
        b'gene_id\tgene_name\torganism_id\torganism_name\tgene_annotation_count\r\n' +  \
        b'59272\tACE2\t9606\tHomo sapiens\t1\r\n'


def test_user_can_get_all_annotations_from_pdf(
        client,
        test_user_with_pdf: Files,
        fix_api_owner: AppUser,
        mock_get_combined_annotations_result,
):
    login_resp = client.login_as_user(fix_api_owner.email, 'password')
    headers = generate_headers(login_resp['access_jwt'])
    file_id = test_user_with_pdf.hash_id

    response = client.post(
        f'/filesystem/objects/{file_id}/annotations/counts',
        headers=headers,
        content_type='application/json',
    )
    assert response.status_code == 200
    assert response.get_data() == \
        b'entity_id\ttype\ttext\tcount\r\n' + \
        b'59272\tGene\tace2\t1\r\n' + \
        b'9606\tSpecies\thuman\t1\r\n'
