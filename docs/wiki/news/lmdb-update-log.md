## Chemical:
CHEBI: dictionary of 'small molecular entities'. Tree structure: https://www.ebi.ac.uk/ols/ontologies/chebi
#### Updated on 11/17/2020
   - Include all chebi terms and synonyms without pruning
#### updated on 10/20/2020
  - Include all chebi terms and synonyms exclude the followings:
    - terms under the following categories: ['subatomic particle', 'role']
    - terms end with 'entity'
    - terms end with 'parent'
    - terms: ['atom', 'group', 'ion]

## Compound
- BioCyc/EcoCyc

## Disease:
#### Updated on 10/20/2020
- Mesh terms mapped as Disease (SCR-Disease)
- MeSH terms (TopicalDescriptor) under tree number 'C', excluding the top two levels (C and Cxx)
- remove terms with ','

## Gene: 
#### Updated on 10/20/2020
- NCBI Genes: symbol, synonyms, excluding 'hypotheical protein'

## Protein:
- SwissProt from UniProt

## Species: 
#### Updated on 10/20/2020
- NCBI Taxonomy:  all taxonomy ranked as species and their children in the following categories
  - Archaea
  - Bacteria
  - Eukaryota
  - Viruses
- Removed 'environmental samples'
- Mapped the following strain parents (up to species) to the strain tax_id:
```
Tax ID	Strain Name
367830	Staphylococcus aureus subsp. aureus USA300
511145	Escherichia coli str. K-12 substr. MG1655
272563	Clostridioides difficile 630
208964	Pseudomonas aeruginosa PAO1
559292	Saccharomyces cerevisiae S288C
```
The resulted tax id mapping as below:
```
tax_id  mapped_to
46170	367830
1280	367830
83333	511145
562	511145
1496	272563
287	208964
4932	559292
``` 
## Food:
#### Updated on 10/20/2020
- Mesh terms (and synonyms) under 'Food' category 
  - remove the name 'Food'
  - remove any synonyms/names with ','

## Anatomy:
#### Updated on 10/20/2020
- All MESH terms (and synonyms) under Anatomy (A) 
  - Removed synonyms with ',' 
  - Removed the following terms: [Anatomy, Body Region, Animal Structures, Bacterial Structures, Plant Structures, Fungal Structures and Viral Structures]

## Phenomena: 

### Updated on 11/5/2020
#### Phenomena and Process: G
- Exclude Physical Phenomena [G01]
- Exclude Genetic Phenomena (which includes Gene Expression branch) [G05]
- Exclude Food (G07.203.300), Beverage(G07.203.100) and Fermented foods and beverages(G07.203.200)
- Exclude Reproductive Physiological Phenomena [G08.686]
- Exclude Respiratory Physiological Phenomena [G09.772]
- Exclude Environment [G16.500.275]
- Exclude mathematical concepts (G17)
- Exclude all terms contains 'phenomena'
- Exclude all terms with ','

#### Psychiatry and Psychology Category: F
- Eliminate all BUT Mental Disorders [F03]
- Exclude all terms contains ','
- Exclude the first two levels in hierarchy tree except 'mental disorders'
