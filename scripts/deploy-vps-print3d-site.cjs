'use strict';

process.env.MDV_DEPLOY_SITE_VARIANT = 'print3d';
process.env.VPS_SITE_ROOT = process.env.VPS_PRINT3D_SITE_ROOT || '/var/www/print3d-site';
require('./deploy-vps-site.cjs');
