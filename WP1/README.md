# WP1: Biodata resource integration


Example to run the term remapping script: 
```
python scripts/make_term_remappings.py \
  --composite data/composite-metazoan.obo \
  --datasets data/datasets.json \
  --out term_remappings.tsv \
  --extra-obo data/collected-metazoan.obo data/cl.obo data/zfa.obo
```

Downlaod the ontologies, from `data` folder: 
```
curl -sLO http://purl.obolibrary.org/obo/uberon/composite-metazoan.obo
curl -sLO http://purl.obolibrary.org/obo/uberon/collected-metazoan.obo
curl -sLO http://purl.obolibrary.org/obo/cl.obo
curl -sLO http://purl.obolibrary.org/obo/zfa.obo
```
