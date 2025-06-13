/*
  # Student Appointment Booking System Database Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `role` (enum: student, staff)
      - `full_name` (text)
      - `email` (text)
      - `phone` (text, optional)
      - `department` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `staff_availability`
      - `id` (uuid, primary key)
      - `staff_id` (uuid, references user_profiles)
      - `day_of_week` (integer, 0-6)
      - `start_time` (time)
      - `end_time` (time)
      - `is_available` (boolean)

    - `appointments`
      - `id` (uuid, primary key)
      - `student_id` (uuid, references user_profiles)
      - `staff_id` (uuid, references user_profiles)
      - `appointment_date` (date)
      - `start_time` (time)
      - `end_time` (time)
      - `status` (enum: pending, approved, declined, cancelled, completed)
      - `subject` (text, optional)
      - `notes` (text, optional)
      - `staff_notes` (text, optional)

    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `title` (text)
      - `message` (text)
      - `type` (enum: appointment, reminder, system)
      - `is_read` (boolean)
      - `appointment_id` (uuid, optional)

  2. Security
    - Enable RLS on all tables
    - Add policies for users to access their own data
    - Add policies for staff to access student data for appointments
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('student', 'staff');
CREATE TYPE appointment_status AS ENUM ('pending', 'approved', 'declined', 'cancelled', 'completed');
CREATE TYPE notification_type AS ENUM ('appointment', 'reminder', 'system');

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  department text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Staff Availability Table
CREATE TABLE IF NOT EXISTS staff_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  staff_id uuid REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  appointment_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status appointment_status DEFAULT 'pending',
  subject text,
  notes text,
  staff_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type notification_type NOT NULL,
  is_read boolean DEFAULT false,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Students can read staff profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (role = 'staff' OR auth.uid() = user_id);

CREATE POLICY "Staff can read student profiles for appointments"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'student' AND EXISTS (
      SELECT 1 FROM appointments 
      WHERE (student_id = user_profiles.user_id OR staff_id = user_profiles.user_id)
      AND (student_id = auth.uid() OR staff_id = auth.uid())
    )
  );

-- Staff Availability Policies
CREATE POLICY "Staff can manage own availability"
  ON staff_availability
  FOR ALL
  TO authenticated
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

CREATE POLICY "Students can read staff availability"
  ON staff_availability
  FOR SELECT
  TO authenticated
  USING (is_available = true);

-- Appointments Policies
CREATE POLICY "Students can manage own appointments"
  ON appointments
  FOR ALL
  TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Staff can manage appointments with them"
  ON appointments
  FOR ALL
  TO authenticated
  USING (staff_id = auth.uid())
  WITH CHECK (staff_id = auth.uid());

-- Notifications Policies
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_staff_availability_staff_id ON staff_availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_availability_day ON staff_availability(day_of_week);
CREATE INDEX IF NOT EXISTS idx_appointments_student_id ON appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON appointments(staff_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update timestamps
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_staff_availability_updated_at
  BEFORE UPDATE ON staff_availability
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();