import fs from 'node:fs';

const deliverySection = fs.readFileSync('components/pdv/DeliverySection.tsx', 'utf8');
const teamService = fs.readFileSync('services/team.ts', 'utf8');
const vpsServer = fs.readFileSync('vps_server.cjs', 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  deliverySection.includes('teamService.createDeliveryFromPdv('),
  'PDV delivery quick create must call the VPS-backed team service method',
);

assert(
  !deliverySection.includes('teamService.create({'),
  'PDV delivery quick create must not call the direct Supabase create method',
);

assert(
  teamService.includes("vpsClient.post<TeamMember>('/team/delivery'"),
  'teamService.createDeliveryFromPdv must write through the VPS endpoint',
);

assert(
  vpsServer.includes("fastify.post('/team/delivery'") &&
    vpsServer.includes("vpsDbInsert('team_members'"),
  'VPS server must expose the delivery creation endpoint backed by the existing team_members table',
);

console.log('pdv delivery create VPS static checks passed');
