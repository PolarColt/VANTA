import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Calendar, Clock, Users, CheckCircle, AlertCircle, Plus, Wifi } from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';

interface DashboardStats {
  totalAppointments: number;
  pendingAppointments: number;
  upcomingAppointments: number;
  todayAppointments: number;
}

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  subject?: string;
  student_profile?: { full_name: string };
  staff_profile?: { full_name: string };
}

const Dashboard: React.FC = () => {
  const { profile, error } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalAppointments: 0,
    pendingAppointments: 0,
    upcomingAppointments: 0,
    todayAppointments: 0,
  });
  const [recentAppointments, setRecentAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && !error) {
      fetchDashboardData();
    } else if (error) {
      // Set demo data for offline mode
      setStats({
        totalAppointments: 12,
        pendingAppointments: 3,
        upcomingAppointments: 5,
        todayAppointments: 2,
      });
      setRecentAppointments([
        {
          id: '1',
          appointment_date: new Date().toISOString().split('T')[0],
          start_time: '10:00',
          end_time: '11:00',
          status: 'approved',
          subject: 'Academic Consultation',
          staff_profile: { full_name: 'Dr. Smith' },
          student_profile: { full_name: 'John Doe' },
        },
        {
          id: '2',
          appointment_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          start_time: '14:00',
          end_time: '15:00',
          status: 'pending',
          subject: 'Career Guidance',
          staff_profile: { full_name: 'Prof. Johnson' },
          student_profile: { full_name: 'Jane Smith' },
        },
      ]);
      setLoading(false);
    }
  }, [profile, error]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch appointments based on role
      const query = supabase
        .from('appointments')
        .select(`
          *,
          student_profile:user_profiles!appointments_student_id_fkey(full_name),
          staff_profile:user_profiles!appointments_staff_id_fkey(full_name)
        `);

      if (profile?.role === 'student') {
        query.eq('student_id', profile.user_id);
      } else {
        query.eq('staff_id', profile.user_id);
      }

      const { data: appointments, error } = await query.order('appointment_date', { ascending: false });

      if (error) throw error;

      if (appointments) {
        const now = new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const stats: DashboardStats = {
          totalAppointments: appointments.length,
          pendingAppointments: appointments.filter(apt => apt.status === 'pending').length,
          upcomingAppointments: appointments.filter(apt => {
            const aptDate = parseISO(`${apt.appointment_date}T${apt.start_time}`);
            return aptDate > now && (apt.status === 'approved' || apt.status === 'pending');
          }).length,
          todayAppointments: appointments.filter(apt => {
            const aptDate = parseISO(apt.appointment_date);
            return isToday(aptDate) && (apt.status === 'approved' || apt.status === 'pending');
          }).length,
        };

        setStats(stats);
        setRecentAppointments(appointments.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAppointmentDate = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM dd, yyyy');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {profile?.full_name || 'Demo User'}!
            </h1>
            <p className="text-blue-100 mt-1">
              {profile?.role === 'student' 
                ? 'Manage your appointments and stay updated with your schedule.' 
                : 'Review appointments and manage your availability.'}
            </p>
          </div>
          {error && (
            <div className="flex items-center bg-yellow-500 bg-opacity-20 rounded-lg px-3 py-2">
              <Wifi className="h-5 w-5 mr-2" />
              <span className="text-sm">Demo Mode</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Appointments</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalAppointments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingAppointments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Upcoming</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.upcomingAppointments}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.todayAppointments}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Appointments */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Recent Appointments</h2>
          <div className="flex space-x-3">
            {(profile?.role === 'student' || error) && (
              <Link
                to="/appointments?action=new"
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-1" />
                Book Appointment
              </Link>
            )}
            <Link
              to="/appointments"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All
            </Link>
          </div>
        </div>
        
        {recentAppointments.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {recentAppointments.map((appointment) => (
              <div key={appointment.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-sm font-medium text-gray-900">
                        {appointment.subject || 'General Consultation'}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500 space-x-4">
                      <span>{formatAppointmentDate(appointment.appointment_date)}</span>
                      <span>{appointment.start_time} - {appointment.end_time}</span>
                      <span>
                        with {(profile?.role === 'student' || error) 
                          ? appointment.staff_profile?.full_name 
                          : appointment.student_profile?.full_name}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              {(profile?.role === 'student' || error)
                ? 'Book your first appointment to get started.' 
                : 'Appointments will appear here once students book with you.'}
            </p>
            {(profile?.role === 'student' || error) && (
              <div className="mt-6">
                <Link
                  to="/appointments?action=new"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Book Your First Appointment
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;