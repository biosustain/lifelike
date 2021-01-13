#!/usr/bin/env zsh

# here's some mwu examples with increasing complexity.

mannwhitney.jl -H -i entrez -a mesh -v npub -q 0.05 -b 0.05 -z -l npub_date10_disease-mesh.tsv < cagpapers_g1g1.tsv > cagpapers_g1g1_disease_npub_date10_mwu1.tsv

# You will need miller (mlr) installed for the next examples. It should be the up-to-date version.

# if you have the src folder in $PATH then you can source the set***ARANGO_USERNAME***.zsh using zsh to set $ROOT to the ***ARANGO_USERNAME*** of the git.
# Otherwise just find the script in whatever path you put it.
. set***ARANGO_USERNAME***.zsh

$ROOT/enrichment/mannwhitney_analysis.sh cagpapers_g1g1.tsv npub_date10_disease-mesh.tsv entrez2symbol.tsv entrez mesh npub '' -q 0.05 -b 0.05 -z -l > cagpapers_g1g1_disease_npub_date10_mwu2.tsv


$ROOT/enrichment/mannwhitney_analysis.sh cagpapers_g1g1.tsv npub_date10_disease-mesh.tsv entrez2symbol.tsv entrez mesh npub '' -q 0.05 -b 0.05 -z -l |
    mlr --tsv cut -x -f entrez then join -f mesh2name.tsv -j mesh then join -f npub_date10_disease-mesh_total.tsv -j mesh --lp total_ then \
    cut -x -f total_nsnip then rename total_npub,total then cat -N row > cagpapers_g1g1_disease_npub_date10_mwu3.tsv





