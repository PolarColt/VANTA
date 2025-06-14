const onSubmit = async (data: RegisterForm) => {
  if (data.password !== data.confirmPassword) {
    toast.error('Passwords do not match');
    return;
  }

  if (data.password.length < 6) {
    toast.error('Password must be at least 6 characters');
    return;
  }

  setLoading(true);

  const {
    data: signUpData,
    error: signUpError,
  } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
  });

  if (signUpError) {
    toast.error(signUpError.message);
    setLoading(false);
    return;
  }

  if (signUpData?.user) {
    const { error: profileError } = await supabase.from('user_profiles').insert([
      {
        user_id: signUpData.user.id,
        full_name: data.fullName,
        role: data.role,
        email: data.email,
        department: data.department,
        phone: data.phone,
      },
    ]);

    if (profileError) {
      console.error('Profile insert error:', profileError.message);
      toast.error('Account created, but profile failed to save.');
    } else {
      toast.success('Account created! Check your email to verify.');
      navigate('/login');
    }
  }

  setLoading(false);
};
