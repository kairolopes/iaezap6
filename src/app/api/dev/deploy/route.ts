import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

/**
 * POST /api/dev/deploy
 *
 * Webhook endpoint to trigger deployment on VPS
 * Pulls latest code, builds, and restarts PM2
 *
 * Header required:
 * X-Deploy-Token: {token from environment}
 */
export async function POST(request: NextRequest) {
  try {
    // Check deploy token
    const deployToken = request.headers.get('x-deploy-token');
    const expectedToken = process.env.DEPLOY_TOKEN || 'deploy-secret-token-change-me';

    if (!deployToken || deployToken !== expectedToken) {
      return NextResponse.json(
        { error: 'Invalid or missing deploy token' },
        { status: 401 }
      );
    }

    // Only allow in production (VPS)
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json(
        { message: 'Deploy endpoint only works on production server' },
        { status: 403 }
      );
    }

    console.log('🚀 Starting deployment...');

    const commands = [
      { cmd: 'git fetch origin', desc: 'Fetching from origin' },
      { cmd: 'git reset --hard origin/main', desc: 'Resetting to origin/main' },
      { cmd: 'npm run build', desc: 'Building...' },
      { cmd: 'pm2 restart all', desc: 'Restarting PM2 processes' },
      { cmd: 'pm2 save', desc: 'Saving PM2 state' },
    ];

    const results: Array<{ cmd: string; desc: string; status: string; output?: string }> = [];

    for (const { cmd, desc } of commands) {
      try {
        console.log(`\n📋 ${desc}`);
        const output = execSync(cmd, {
          cwd: process.env.APP_ROOT || '/root/iaezap6',
          stdio: 'pipe',
          encoding: 'utf-8',
        });

        console.log('✅', output.split('\n').slice(0, 3).join('\n'));
        results.push({
          cmd,
          desc,
          status: 'success',
          output: output.substring(0, 200),
        });
      } catch (error: any) {
        const errorMsg = error.message || 'Unknown error';
        console.error('❌', errorMsg.substring(0, 100));
        results.push({
          cmd,
          desc,
          status: 'error',
          output: errorMsg.substring(0, 200),
        });

        // Don't continue if a critical step fails
        if (cmd.includes('build')) {
          throw error;
        }
      }
    }

    console.log('\n✨ Deployment complete!');

    return NextResponse.json({
      success: true,
      message: 'Deployment completed successfully',
      timestamp: new Date().toISOString(),
      steps: results,
    });
  } catch (error: any) {
    console.error('Deployment error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Deployment failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Deploy-Token',
    },
  });
}
