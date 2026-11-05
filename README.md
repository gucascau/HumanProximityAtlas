# Human Proximity Atlas

**Website: <https://gucascau.github.io/HumanProximityAtlas/>**

The Human Proximity Atlas is an integrated resource of human protein proximity networks built from a uniform
reanalysis of public proximity-labelling proteomics data (BioID, TurboID/miniTurbo and APEX). Published proximity
labelling studies differ in search software, statistics, controls and thresholds, so their results cannot be compared
directly. We collected human label-free datasets from ProteomeXchange, processed every raw file with the same FragPipe
workflow, matched each bait to appropriate controls, and scored all bait-versus-control comparisons with
[ProxLabToolkit](https://github.com/gucascau/ProxLabToolkit), a consensus statistical framework that combines six
differential-abundance methods with a spectral-count model.

After quality control, the atlas contains **84 projects, 695 comparisons, 515 bait proteins and 171,801 bait–protein
proximity pairs** involving 8,593 proteins. Because each protein is captured by many baits, the collection also forms a
**proximity map**: non-negative matrix factorisation of the protein × bait matrix resolves 20 subcellular
neighbourhoods and assigns **6,621 proteins** to a compartment (4,227 with high or medium confidence), including
proteins without any UniProt localisation and poorly characterised proteins. Predictions agree with UniProt, Human
Protein Atlas imaging and the Human Cell Map well above chance. Disease genes concentrate in specific
neighbourhoods (for example mitochondrial disease genes in the mitochondrial matrix and ciliopathy genes at the
centrosome and cilium), and the map ranks candidate disease genes from their proximity neighbours.

## What you can do on the website

- **Search any bait or protein** and see its binding partners in every study, with fold change, adjusted P value,
  confidence, published support and whether a partner is a stable core interactor or context dependent
- **Explore the proximity map** of 7,133 proteins, coloured by predicted compartment; highlight your own gene list
- **Browse the 20 neighbourhoods** with their marker proteins, baits and disease-gene enrichment
- **See the source studies** (technology, cell line, reliability tier, links to PRIDE/MassIVE and PubMed)
- **Download** all tables

## Data and code

- Analysis software: [ProxLabToolkit](https://github.com/gucascau/ProxLabToolkit)
- Raw data: the original ProteomeXchange projects listed on the Studies page
- This repository holds the static website (HTML, CSS, JavaScript and JSON data; no server required)

## Citation

Human Proximity Atlas, version 1.0 (November 2026). Manuscript in preparation. Please also cite the original
studies whose data you use.

## License

Website code: MIT License (see `LICENSE`). Data are derived from public ProteomeXchange datasets; please cite the original studies.
