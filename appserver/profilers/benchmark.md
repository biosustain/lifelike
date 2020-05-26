# Annotations Benchmark

See PR for original profiled time: https://github.com/SBRG/kg-prototypes/pull/266

*Updated: 5/20/2020*

Without getting into the nitty gritty of the function call stack, the execution time recorded in this document will be for the ***ARANGO_USERNAME*** functions. This does not include network latency or insertions into postgresql.

Run: `docker-compose exec appserver python profilers/annotations_profiler.py`.

**These PDFs can be found in**: `tests/databases/services/annotations/pdf_samples`.

**total_time**: the total time in seconds spent in the function.

**cum_time**: the total time in seconds spent in the function plus all other functions the current function called.


For dysregulation-of-the-IFN-y-stat1.pdf (16 pages):
| ncalls | total_time | cum_time | function_name |
| ------ | ---------- | -------- | ------------- |
| 1 | 0.0002616 | 10.82 | annotations_service.py:953(create_annotations) |
| 1 |0.1749 | 8.901 | annotations_service.py:154(_filter_tokens) |
| 47933 | 0.228 | 8.484 | annotations_service.py:73(lmdb_validation) |
| 1 | 0.04226 | 6.735 | annotations_pdf_parser.py:81(parse_pdf) |
| 1 | 0.7059 | 4.238 | annotations_pdf_parser.py:198(extract_tokens) |


For emergence-of-antibiotic-resistance-in-bacteria.pdf (7 pages):
| ncalls | total_time | cum_time | function_name |
| ------ | ---------- | -------- | ------------- |
| 1 | 0.0001681 | 9.258 | annotations_service.py:953(create_annotations) |
| 1 | 0.1279 | 7.592 | annotations_service.py:154(_filter_tokens) |
| 25549 | 0.1616 | 7.306 | annotations_service.py:73(lmdb_validation) |
| 1 | 0.02322 | 2.923 | annotations_pdf_parser.py:81(parse_pdf) |
| 1 | 0.3727 | 	2.288 | annotations_pdf_parser.py:198(extract_tokens) |


For Protein Protein Interactions for Covid.pdf (45 pages):
| ncalls | total_time | cum_time | function_name |
| ------ | ---------- | -------- | ------------- |
| 1 | 0.09124 | 26.59 | annotations_pdf_parser.py:81(parse_pdf) |
| 1 | 0.001287 | 20.5 | annotations_service.py:953(create_annotations) |
| 1 | 0.3402 | 14.73 | annotations_service.py:154(_filter_tokens) |
| 95713 | 0.4452 | 13.93 | annotations_service.py:73(lmdb_validation) |
| 1 | 1.501 | 8.48 | annotations_pdf_parser.py:198(extract_tokens) |
