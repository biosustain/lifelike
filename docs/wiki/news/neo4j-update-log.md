## LifeLike prod 0.9 - 9/23/2020

#### Neo4j version 4.1.0
Public Data
- NCBI Genes and Taxonomy
- Uniprot SwissProt
- MESH 2020
- ChEBI
- GO
- Enzyme
- EcoCyc 24.0
- RegulonDB 10.0
- Stanford literature mining dataset (version 7)
- PubMed (limited publications for those referenced by stanford literature dataset)

## LifeLike prod 0.91 - 11/10/2020
python script: lifelike_data_loader.update_lifelike_0.9()

- loaded more BioCyc data, including HumanCyc, YeastCyc and Pput160488Cyc. 
- Added a displayName property for BioCyc nodes.
    - Regulation:  regulation type + mode (+/-)
    - Reaction: 
        - EC number
        - If no EC number, use name
        - If no name, use biocyc_id
    - TranscriptionUnit: 
        - name + ‘ TU'
        - if no name, get all matches, and connect with ‘-', then add 'TU’
    - DNABindingSite:
        - regulator protein name + ‘BS'
    - All others:
        - name
        - If no name, use biocyc id
- loaded STRING protein annotations for the following organisms:
    - human
    - E. coli
    - Yeast 
    - Pseudomonas putida
- Added taxonomy synonyms - combined_terms 
- Added properties for gene enrichment table:
    - Add property 'function' for uniprot proteins 
    - add properties 'regulator_family', 'activated_by', 'repressed_by' to RegulonDB matches
    - add proterty 'pathways' for biocyc matches
