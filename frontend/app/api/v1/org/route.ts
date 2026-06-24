import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser(token);
  const user = data.user;

  const orgName = user?.user_metadata?.org_name ?? 'PI Partners';

  return NextResponse.json({
    _id: user?.id ?? 'pip-org',
    registeredName: orgName,
    shortName: 'PIP',
    domain: 'pipartners.com',
    accountType: 'enterprise',
    contactEmail: user?.email ?? '',
  });
}

export async function POST(req: NextRequest) {
  try {
    const { contactEmail, password, adminFullName, registeredName } = await req.json();

    if (!contactEmail || !password || !adminFullName) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email: contactEmail,
      password,
      options: {
        data: {
          full_name: adminFullName,
          org_name: registeredName,
        },
      },
    });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    const session = data.session;
    const user = data.user;

    return NextResponse.json({
      accessToken: session?.access_token ?? '',
      refreshToken: session?.refresh_token ?? '',
      user: {
        id: user?.id,
        email: user?.email,
        name: adminFullName,
        created_at: user?.created_at,
      },
    });
  } catch (err) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
