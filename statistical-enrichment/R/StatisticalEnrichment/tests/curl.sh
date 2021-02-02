curl -X POST localhost:3000/update -d \
  '{"type":"a", "list": [{"entity":"sadg","category":"a"}]}' -i

#curl -X POST localhost:3000/binom/enrich -d \
#  '{"annotations":[{"id":"sadg","annotation":"a"}],"GOIs":["sadg"],"qThreshold":"asfge"}' -i

curl -X POST localhost:3000/fisher/enrich -d \
  '{"type":"a","entities":["sadg"],"qThreshold":0.05}' -i
