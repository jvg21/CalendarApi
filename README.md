# 11. Nova versão - Build
docker build -t jvg21/tassinary-agendamento:v1.1.7 .
docker build -t jvg21/tassinary-agendamento:latest .


docker login

# 12. Nova versão - Push
docker push jvg21/tassinary-agendamento:v1.1.7
docker push jvg21/tassinary-agendamento:latest

# 13. Verificar versões disponíveis
docker images jvg21/tassinary-agendamento
