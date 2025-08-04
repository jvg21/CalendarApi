// src/scripts/test-appointments-filters.ts
// Script para testar todos os filtros do endpoint /api/appointments

import dotenv from 'dotenv';
import { supabase } from '../config/supabase';

dotenv.config();

async function testAppointmentsFilters() {
  console.log('🧪 Testando filtros do endpoint /api/appointments\n');

  try {
    // 1. TESTE BÁSICO - Buscar todos os appointments
    console.log('📋 1. Teste básico - Todos os appointments');
    const { data: allAppointments, error: allError } = await supabase
      .from('appointments')
      .select(`
        *,
        instances(name),
        calendars(name),
        services(name, duration)
      `)
      .order('start_datetime', { ascending: false })
      .limit(5);

    if (allError) {
      console.error('❌ Erro na busca básica:', allError);
      return;
    }

    console.log(`✅ Total de appointments encontrados: ${allAppointments?.length || 0}`);
    
    if (allAppointments && allAppointments.length > 0) {
      console.log('📊 Primeiros 3 appointments:', allAppointments.slice(0, 3).map(apt => ({
        id: apt.id,
        title: apt.title,
        start_datetime: apt.start_datetime,
        status: apt.status,
        instance_name: apt.instances?.name,
        calendar_name: apt.calendars?.name,
        service_name: apt.services?.name,
        flow_id: apt.flow_id,
        agent_id: apt.agent_id,
        user_id: apt.user_id,
        client_email: apt.client_email
      })));

      // Extrair dados para testes
      const sampleAppointment = allAppointments[0];
      const testInstanceId = sampleAppointment.instance_id;
      const testStatus = sampleAppointment.status;
      const testFlowId = sampleAppointment.flow_id;
      const testAgentId = sampleAppointment.agent_id;
      const testUserId = sampleAppointment.user_id;
      const testDate = sampleAppointment.start_datetime.split('T')[0]; // YYYY-MM-DD

      console.log('\n🎯 Dados extraídos para testes:', {
        testInstanceId,
        testStatus,
        testFlowId,
        testAgentId,
        testUserId,
        testDate
      });

      // 2. TESTE FILTRO POR INSTANCE_ID
      if (testInstanceId) {
        console.log('\n📋 2. Teste filtro por instance_id');
        const { data: instanceFiltered, error: instanceError } = await supabase
          .from('appointments')
          .select('id, instance_id, title')
          .eq('instance_id', testInstanceId)
          .limit(3);

        if (instanceError) {
          console.error('❌ Erro no filtro instance_id:', instanceError);
        } else {
          console.log(`✅ Filtro instance_id: ${instanceFiltered?.length || 0} results`);
          console.log('📊 Sample results:', instanceFiltered?.map(r => ({
            id: r.id,
            instance_id: r.instance_id,
            title: r.title
          })));
        }
      }

      // 3. TESTE FILTRO POR STATUS
      if (testStatus) {
        console.log('\n📋 3. Teste filtro por status');
        const { data: statusFiltered, error: statusError } = await supabase
          .from('appointments')
          .select('id, status, title')
          .eq('status', testStatus)
          .limit(3);

        if (statusError) {
          console.error('❌ Erro no filtro status:', statusError);
        } else {
          console.log(`✅ Filtro status "${testStatus}": ${statusFiltered?.length || 0} results`);
        }
      }

      // 4. TESTE FILTRO POR DATA
      console.log('\n📋 4. Teste filtro por data');
      const { data: dateFiltered, error: dateError } = await supabase
        .from('appointments')
        .select('id, start_datetime, title')
        .gte('start_datetime', `${testDate}T00:00:00`)
        .lte('start_datetime', `${testDate}T23:59:59`)
        .limit(5);

      if (dateError) {
        console.error('❌ Erro no filtro de data:', dateError);
      } else {
        console.log(`✅ Filtro data "${testDate}": ${dateFiltered?.length || 0} results`);
        console.log('📊 Results:', dateFiltered?.map(r => ({
          id: r.id,
          start_datetime: r.start_datetime,
          title: r.title
        })));
      }

      // 5. TESTE FILTROS NUMÉRICOS (se existirem)
      if (testFlowId) {
        console.log('\n📋 5. Teste filtro por flow_id');
        const { data: flowFiltered, error: flowError } = await supabase
          .from('appointments')
          .select('id, flow_id, title')
          .eq('flow_id', testFlowId)
          .limit(3);

        if (flowError) {
          console.error('❌ Erro no filtro flow_id:', flowError);
        } else {
          console.log(`✅ Filtro flow_id "${testFlowId}": ${flowFiltered?.length || 0} results`);
        }
      }

      if (testAgentId) {
        console.log('\n📋 6. Teste filtro por agent_id');
        const { data: agentFiltered, error: agentError } = await supabase
          .from('appointments')
          .select('id, agent_id, title')
          .eq('agent_id', testAgentId)
          .limit(3);

        if (agentError) {
          console.error('❌ Erro no filtro agent_id:', agentError);
        } else {
          console.log(`✅ Filtro agent_id "${testAgentId}": ${agentFiltered?.length || 0} results`);
        }
      }

      if (testUserId) {
        console.log('\n📋 7. Teste filtro por user_id');
        const { data: userFiltered, error: userError } = await supabase
          .from('appointments')
          .select('id, user_id, title')
          .eq('user_id', testUserId)
          .limit(3);

        if (userError) {
          console.error('❌ Erro no filtro user_id:', userError);
        } else {
          console.log(`✅ Filtro user_id "${testUserId}": ${userFiltered?.length || 0} results`);
        }
      }

      // 8. TESTE FILTRO COMBINADO
      console.log('\n📋 8. Teste filtro combinado (instance_id + status + data)');
      const { data: combinedFiltered, error: combinedError } = await supabase
        .from('appointments')
        .select('id, instance_id, status, start_datetime, title')
        .eq('instance_id', testInstanceId)
        .eq('status', testStatus)
        .gte('start_datetime', `${testDate}T00:00:00`)
        .lte('start_datetime', `${testDate}T23:59:59`)
        .limit(5);

      if (combinedError) {
        console.error('❌ Erro no filtro combinado:', combinedError);
      } else {
        console.log(`✅ Filtro combinado: ${combinedFiltered?.length || 0} results`);
      }

      // 9. TESTE DE CONTAGEM TOTAL
      console.log('\n📋 9. Teste de contagem total por status');
      const statuses = ['scheduled', 'confirmed', 'cancelled', 'completed'];
      
      for (const status of statuses) {
        const { count, error } = await supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('status', status);

        if (error) {
          console.error(`❌ Erro contando status "${status}":`, error);
        } else {
          console.log(`📊 Status "${status}": ${count} appointments`);
        }
      }

      console.log('\n🎉 Teste de filtros concluído!');
      console.log('\n💡 Para testar via HTTP, use URLs como:');
      console.log(`GET /api/appointments?instance_id=${testInstanceId}`);
      console.log(`GET /api/appointments?status=${testStatus}`);
      console.log(`GET /api/appointments?start_date=${testDate}`);
      console.log(`GET /api/appointments?start_date=${testDate}&end_date=${testDate}`);
      console.log(`GET /api/appointments?flow_id=${testFlowId || 1}`);
      console.log(`GET /api/appointments?page=1&limit=10`);

    } else {
      console.log('⚠️ Nenhum appointment encontrado no banco. Crie alguns appointments primeiro.');
    }

  } catch (error) {
    console.error('❌ Erro geral no teste:', error);
  }
}

// Para executar: npm run test:filters
// Adicione ao package.json: "test:filters": "ts-node src/scripts/test-appointments-filters.ts"
testAppointmentsFilters().catch(console.error);