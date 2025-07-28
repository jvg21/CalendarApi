/**
 * @swagger
 * /api/availability/check:
 *   post:
 *     tags: [Availability]
 *     summary: Check specific time slot availability
 *     description: Verifica se um horário específico está disponível para agendamento
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start_datetime, service_id, calendar_id]
 *             properties:
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: Data/hora de início desejada (ISO 8601)
 *                 example: "2024-03-15T14:00:00-03:00"
 *               service_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do serviço
 *               calendar_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do calendário
 *     responses:
 *       200:
 *         description: Resultado da verificação de disponibilidade
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   description: Se o horário está disponível
 *                 calendar_name:
 *                   type: string
 *                   description: Nome do calendário
 *                 start_datetime:
 *                   type: string
 *                   format: date-time
 *                   description: Horário de início
 *                 end_datetime:
 *                   type: string
 *                   format: date-time
 *                   description: Horário de fim
 *                 service_name:
 *                   type: string
 *                   description: Nome do serviço
 *                 service_duration:
 *                   type: integer
 *                   description: Duração do serviço em minutos
 *                 conflict_reason:
 *                   type: string
 *                   description: Razão do conflito (se não disponível)
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/availability/suggest:
 *   post:
 *     tags: [Availability]
 *     summary: Get availability suggestions with advanced strategies
 *     description: Sugere horários disponíveis usando diferentes estratégias de agendamento
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [start_datetime, end_datetime, service_id, calendar_ids]
 *             properties:
 *               start_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: Data/hora de início da busca (ISO 8601)
 *                 example: "2024-03-15T08:00:00-03:00"
 *               end_datetime:
 *                 type: string
 *                 format: date-time
 *                 description: Data/hora de fim da busca (ISO 8601)
 *                 example: "2024-03-20T18:00:00-03:00"
 *               service_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do serviço
 *               calendar_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: IDs dos calendários para verificar
 *               max_results:
 *                 type: integer
 *                 default: 10
 *                 minimum: 1
 *                 maximum: 50
 *                 description: Número máximo de sugestões
 *               expand_timeframe:
 *                 type: boolean
 *                 default: false
 *                 description: Se deve expandir o período de busca para encontrar mais horários
 *               interval_minutes:
 *                 type: integer
 *                 default: 30
 *                 minimum: 15
 *                 maximum: 120
 *                 description: Intervalo em minutos entre slots sugeridos
 *               strategy:
 *                 type: string
 *                 enum: [equality, earliest, nearest, time_blocks, balanced_distribution]
 *                 default: earliest
 *                 description: |
 *                   Estratégia de sugestão:
 *                   - equality: Distribui igualmente entre calendários
 *                   - earliest: Primeiros horários disponíveis
 *                   - nearest: Horários mais próximos ao momento atual
 *                   - time_blocks: Distribui por períodos (manhã, tarde, noite)
 *                   - balanced_distribution: Distribui uniformemente ao longo dos dias
 *               priority_config:
 *                 type: object
 *                 description: Configuração de prioridade dos calendários
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                     default: true
 *                     description: Se deve considerar prioridade dos calendários
 *                   order:
 *                     type: string
 *                     enum: [asc, desc]
 *                     default: asc
 *                     description: |
 *                       Ordem da prioridade:
 *                       - asc: Menor número = maior prioridade
 *                       - desc: Maior número = maior prioridade
 *               time_blocks_config:
 *                 type: object
 *                 description: Configuração para estratégia time_blocks
 *                 properties:
 *                   morning_slots:
 *                     type: integer
 *                     description: Número de slots da manhã (padrão: 33% do total)
 *                   afternoon_slots:
 *                     type: integer
 *                     description: Número de slots da tarde (padrão: 33% do total)
 *                   evening_slots:
 *                     type: integer
 *                     description: Número de slots da noite (padrão: 34% do total)
 *                   morning_start:
 *                     type: string
 *                     pattern: '^\\d{2}:\\d{2}$'
 *                     default: "06:00"
 *                     description: Horário de início da manhã
 *                   afternoon_start:
 *                     type: string
 *                     pattern: '^\\d{2}:\\d{2}$'
 *                     default: "12:00"
 *                     description: Horário de início da tarde
 *                   evening_start:
 *                     type: string
 *                     pattern: '^\\d{2}:\\d{2}$'
 *                     default: "18:00"
 *                     description: Horário de início da noite
 *           examples:
 *             earliest_strategy:
 *               summary: Estratégia "earliest" (mais cedo)
 *               value:
 *                 start_datetime: "2024-03-15T08:00:00-03:00"
 *                 end_datetime: "2024-03-20T18:00:00-03:00"
 *                 service_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 calendar_ids: ["456e7890-e89b-12d3-a456-426614174001"]
 *                 max_results: 10
 *                 strategy: "earliest"
 *                 priority_config:
 *                   enabled: true
 *                   order: "asc"
 *             time_blocks_strategy:
 *               summary: Estratégia "time_blocks" (por períodos)
 *               value:
 *                 start_datetime: "2024-03-15T08:00:00-03:00"
 *                 end_datetime: "2024-03-20T18:00:00-03:00"
 *                 service_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 calendar_ids: ["456e7890-e89b-12d3-a456-426614174001"]
 *                 max_results: 12
 *                 strategy: "time_blocks"
 *                 priority_config:
 *                   enabled: true
 *                   order: "asc"
 *                 time_blocks_config:
 *                   morning_slots: 4
 *                   afternoon_slots: 4
 *                   evening_slots: 4
 *                   morning_start: "08:00"
 *                   afternoon_start: "13:00"
 *                   evening_start: "17:00"
 *             balanced_distribution:
 *               summary: Estratégia "balanced_distribution" (distribuição balanceada)
 *               value:
 *                 start_datetime: "2024-03-15T08:00:00-03:00"
 *                 end_datetime: "2024-03-22T18:00:00-03:00"
 *                 service_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 calendar_ids: ["456e7890-e89b-12d3-a456-426614174001"]
 *                 max_results: 14
 *                 strategy: "balanced_distribution"
 *                 expand_timeframe: true
 *                 priority_config:
 *                   enabled: true
 *                   order: "asc"
 *     responses:
 *       200:
 *         description: Lista de horários disponíveis
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       start_datetime:
 *                         type: string
 *                         format: date-time
 *                         description: Horário de início
 *                       end_datetime:
 *                         type: string
 *                         format: date-time
 *                         description: Horário de fim
 *                       calendar_id:
 *                         type: string
 *                         format: uuid
 *                         description: ID do calendário
 *                       calendar_name:
 *                         type: string
 *                         description: Nome do calendário
 *                       priority:
 *                         type: integer
 *                         description: Prioridade do calendário
 *                 total_found:
 *                   type: integer
 *                   description: Total de horários encontrados
 *                 search_params:
 *                   type: object
 *                   description: Parâmetros utilizados na busca
 *                   properties:
 *                     start_datetime:
 *                       type: string
 *                       format: date-time
 *                     end_datetime:
 *                       type: string
 *                       format: date-time
 *                     service_id:
 *                       type: string
 *                       format: uuid
 *                     calendar_ids:
 *                       type: array
 *                       items:
 *                         type: string
 *                         format: uuid
 *                     max_results:
 *                       type: integer
 *                     expand_timeframe:
 *                       type: boolean
 *                     interval_minutes:
 *                       type: integer
 *                     strategy:
 *                       type: string
 *                     priority_config:
 *                       type: object
 *                     time_blocks_config:
 *                       type: object
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */