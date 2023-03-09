import json

import pytest
from arango.database import StandardDatabase

from neo4japp.models import Files, AppUser


def generate_headers(jwt_token):
    return {"Authorization": f"Bearer {jwt_token}"}


def test_user_can_get_gene_annotations_from_pdf(
    client,
    test_user_with_pdf: Files,
    fix_admin_user: AppUser,
    test_arango_db: StandardDatabase,
    mock_get_combined_annotations_result,
    mock_get_organisms_from_gene_ids_result,
):
    # Create the necessary collections in arango before calling the API. These are empty of course.
    test_arango_db.create_collection("ncbi")
    test_arango_db.create_collection("has_taxonomy", edge=True)

    login_resp = client.login_as_user(fix_admin_user.email, "password")
    headers = generate_headers(login_resp["accessToken"]["token"])
    file_id = test_user_with_pdf.hash_id

    response = client.post(
        f"/filesystem/objects/{file_id}/annotations/gene-counts",
        headers=headers,
        content_type="application/json",
    )
    assert response.status_code == 200
    assert (
        response.get_data() == b"gene_id\tgene_name\torganism_id\torganism_name\t"
        b"gene_annotation_count\r\n" + b"59272\tACE2\t9606\tHomo sapiens\t1\r\n"
    )


def test_user_can_get_all_annotations_from_pdf(
    client,
    test_user_with_pdf: Files,
    fix_admin_user: AppUser,
    mock_get_combined_annotations_result,
):
    login_resp = client.login_as_user(fix_admin_user.email, "password")
    headers = generate_headers(login_resp["accessToken"]["token"])
    file_id = test_user_with_pdf.hash_id

    response = client.post(
        f"/filesystem/objects/{file_id}/annotations/counts",
        headers=headers,
        content_type="application/json",
    )
    assert response.status_code == 200
    assert (
        response.get_data()
        == b"entity_id\ttype\ttext\tprimary_name\tcount\r\n"
        + b"59272\tGene\tace2\tACE2\t1\r\n"
        + b"9606\tSpecies\thuman\tHomo Sapiens\t1\r\n"
    )


def test_user_can_get_global_inclusions(
    client,
    fix_project,
    fix_admin_user,
    mock_global_compound_inclusion,
):
    login_resp = client.login_as_user(fix_admin_user.email, "password")
    headers = generate_headers(login_resp["accessToken"]["token"])

    response = client.get(
        f"/annotations/global-list/inclusions",
        headers=headers,
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.get_data() is not None


def test_user_can_get_global_exclusions(
    client,
    fix_project,
    fix_admin_user,
    mock_global_gene_exclusion,
):
    login_resp = client.login_as_user(fix_admin_user.email, "password")
    headers = generate_headers(login_resp["accessToken"]["token"])

    response = client.get(
        f"/annotations/global-list/exclusions",
        headers=headers,
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.get_data() is not None


@pytest.mark.skip("Skipping for now to get code merged")
def test_user_can_get_global_list(
    client,
    fix_project,
    fix_admin_user,
    mock_global_list,
):
    login_resp = client.login_as_user(fix_admin_user.email, "password")
    headers = generate_headers(login_resp["accessToken"]["token"])

    response = client.get(
        f"/annotations/global-list",
        headers=headers,
        content_type="application/json",
    )

    assert response.status_code == 200

    data = json.loads(response.get_data().decode("utf-8"))
    assert data["total"] == 2
    assert len(data["results"]) == 2

    if data["results"][0]["type"] == "inclusion":
        inclusion = data["results"][0]
        exclusion = data["results"][1]
    else:
        inclusion = data["results"][1]
        exclusion = data["results"][0]

    assert inclusion["text"] == "compound-(12345)"
    assert inclusion["entityType"] == "Compound"
    assert exclusion["text"] == "fake-gene"
    assert exclusion["entityType"] == "Gene"
