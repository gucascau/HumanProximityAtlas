# Human Proximity Atlas v1.0

A reanalysis of public proximity-labelling proteomics (BioID, TurboID, miniTurbo, APEX) with ProxLabToolkit, integrated
into bait-protein calls, a protein proximity map and disease applications. Release built 2026-11-14.

**Call rule:** adjusted P <= 0.05, log2 fold change > 0.25 and >= 3 intensity tests significant (ProxLabToolkit default). The bait protein itself is not counted. Statistics use ProxLabToolkit with the robust
dependence correction for the combined P value.

## Contents

| Layer | File | Rows | What it is |
|---|---|---|---|
| 1 Experiments | `1_experiments/projects.tsv` | 110 | Projects (data sets) analysed |
| | `1_experiments/comparisons.tsv` | 696 | Bait-vs-control comparisons in the atlas |
| | `1_experiments/comparisons_excluded.tsv` | 260 | Comparisons excluded by QC, with the reason |
| | `1_experiments/comparison_statistics.tsv.gz` | 1,738,135 | Every tested protein in every comparison, with statistics and the call |
| 2 Calls | `2_calls/calls.tsv.gz` | 159,028 | Calls: one row per comparison and called protein |
| | `2_calls/pairs.tsv.gz` | 137,751 | Unique bait gene-protein pairs with prior evidence and reproducibility |
| 3 Organisation | `3_organisation/protein_map.tsv` | 7,023 | Neighbourhood, compartment, confidence and neighbours per protein |
| | `3_organisation/neighbourhoods.tsv` | 20 | The map's neighbourhoods |
| | `3_organisation/bait_clusters.tsv` | 503 | Bait clusters by labelling profile |
| | `3_organisation/compartment_cores.tsv` | 1,096 | Compartment-associated core proteins |
| | `3_organisation/background_proteins.tsv` | 144 | Broadly bound proteins: an empirical background list |
| 4 Applications | `4_applications/disease_*.tsv` | | Disease enrichment, prediction performance, candidates, ClinVar check |
| | `4_applications/validation_candidates.tsv` | 190 | Shortlist for experimental validation |
| | `4_applications/wt1_query_example/` | | Worked example: interpreting a new data set (WT1) against the atlas |

`Supplementary_Tables/` holds the same tables as ST1-ST7 (.xlsx) for the manuscript. `data_dictionary.tsv` describes
every column; `MANIFEST.tsv` lists rows, columns, MD5 checksum, source and generating script for each file.

## Identifiers
Proteins: HGNC gene symbol (`protein`, `bait_gene`) and UniProt accession (`uniprot`). Comparisons: `comparison_id`
= bait gene|project|comparison. Projects: ProteomeXchange (PXD) or MassIVE identifiers.

## Reading the protein map
`confidence` (High / Medium / Low) summarises assignment strength, bait and project coverage and reproducibility under
bait resampling; it is an evidence tier, not a probability. `prediction_status` relates each assignment to UniProt.
Assignments that **differ from UniProt** did not replicate as a class in a temporal hold-out test (later experiments
did not label these proteins preferentially), and organelle-IP proteomics sided with UniProt for most of them, so treat
them as hypotheses needing direct validation. Assignments that **fill a gap** (no UniProt location) showed a weaker
positive trend in the hold-out test and agreed with organelle-IP labels well above chance. Validation operates at the
compartment level; finer neighbourhood distinctions are not independently validated.

## Licence
Data: CC BY 4.0 (`LICENSE.txt`). Please cite the accompanying article.
