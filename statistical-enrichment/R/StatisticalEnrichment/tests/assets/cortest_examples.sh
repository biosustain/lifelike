#!/usr/bin/env zsh

# cortest takes count numbers into account.


cortest.R -i entrez -g mesh -v npub -V npub -q 0.05 npub_date10_disease-mesh.tsv < cagpapers.tsv > cagpapers_disease_npub_date10_cortest1.tsv

cortest.R -i entrez -g mesh -v npub -V npub -q 0.05 npub_date10_disease-mesh.tsv entrez2symbol.tsv mesh2name.tsv < cagpapers.tsv |
        mlr --tsv cut -x -f entrez then join -f npub_date10_disease-mesh_total.tsv -j mesh --lp total_ then cut -x -f total_nsnip then rename total_npub,total then \
        cat -N row > cagpapers_disease_npub_date10_cortest2.tsv


