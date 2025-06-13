import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Calendar, 
  Clock, 
  User, 
  Plus, 
  Filter, 
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Edit,
  Trash2,
  MessageSquare
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns';
import AppointmentModal from '../components/AppointmentModal';
import toast from 'react-hot-toast';

interface Appointment {
  id: string;
  student_id: string;
  staff_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'declined' | 'cancelled' | 'completed';
  subject?: string;
  notes?: string;
  staff_notes?: string;
  created_at: string;
  student_profile?: { full_name: string; email: string; department?: string };
  staff_profile?: { full_name: string; email: string; department?: string };
}

const Appointments: React.FC = () => {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [staffNotesModal, setStaffNotesModal] = useState<{ isOpen: boolean; appointment: Appointment | null }>({
    isOpen: false,
    appointment: null,
  });
  const [staffNotes, setStaffNotes] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, [profile]);

  useEffect(() => {
    filterAppointments();
  }, [appointments, statusFilter, searchTerm]);

  const fetchAppointments = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      
      const query = supabase
        .from('appointments')
        .select(`
          *,
          student_profile:user_profiles!appointments_student_id_fkey(full_name, email, department),
          staff_profile:user_profiles!appointments_staff_id_fkey(full_name, email, department)
        `);

      if (profile.role === 'student') {
        query.eq('student_id', profile.user_id);
      } else {
        query.eq('staff_id', profile.user_id);
      }

      const { data, error } = await query.order('appointment_date', { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = () => {
    let filtered = appointments;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(apt => apt.status === statusFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(apt => 
        apt.subject?.toLowerCase().includes(term) ||
        apt.student_profile?.full_name.toLowerCase().includes(term) ||
        apt.staff_profile?.full_name.toLowerCase().includes(term) ||
        apt.notes?.toLowerCase().includes(term)
      );
    }

    setFilteredAppointments(filtered);
  };

  const updateAppointmentStatus = async (appointmentId: string, newStatus: string, notes?: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (notes !== undefined) {
        updateData.staff_notes = notes;
      }

      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success(`Appointment ${newStatus} successfully!`);
      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      toast.error('Failed to update appointment');
    }
  };

  const deleteAppointment = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) return;

    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) throw error;

      toast.success('Appointment deleted successfully!');
      fetchAppointments();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      toast.error('Failed to delete appointment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'declined':
        return <XCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatAppointmentDate = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM dd, yyyy');
  };

  const canEditAppointment = (appointment: Appointment) => {
    if (profile?.role === 'staff') return false;
    return appointment.status === 'pending' && !isPast(parseISO(`${appointment.appointment_date}T${appointment.start_time}`));
  };

  const canCancelAppointment = (appointment: Appointment) => {
    return ['pending', 'approved'].includes(appointment.status) && 
           !isPast(parseISO(`${appointment.appointment_date}T${appointment.start_time}`));
  };

  const handleStaffNotesSubmit = () => {
    if (staffNotesModal.appointment) {
      updateAppointmentStatus(staffNotesModal.appointment.id, staffNotesModal.appointment.status, staffNotes);
      setStaffNotesModal({ isOpen: false, appointment: null });
      setStaffNotes('');
    }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
          <p className="text-gray-600 mt-1">
            {profile?.role === 'student' 
              ? 'Manage your appointment bookings' 
              : 'Review and manage student appointments'}
          </p>
        </div>
        
        {profile?.role === 'student' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Book Appointment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search appointments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredAppointments.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredAppointments.map((appointment) => (
              <div key={appointment.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {appointment.subject || 'General Consultation'}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(appointment.status)}`}>
                        {getStatusIcon(appointment.status)}
                        <span className="ml-1 capitalize">{appointment.status}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>{formatAppointmentDate(appointment.appointment_date)}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>{appointment.start_time} - {appointment.end_time}</span>
                      </div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2" />
                        <span>
                          {profile?.role === 'student' 
                            ? appointment.staff_profile?.full_name 
                            : appointment.student_profile?.full_name}
                          {profile?.role === 'staff' && appointment.student_profile?.department && 
                            ` (${appointment.student_profile.department})`}
                        </span>
                      </div>
                    </div>

                    {appointment.notes && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-700">
                          <strong>Notes:</strong> {appointment.notes}
                        </p>
                      </div>
                    )}

                    {appointment.staff_notes && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-md">
                        <p className="text-sm text-blue-700">
                          <strong>Staff Notes:</strong> {appointment.staff_notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {profile?.role === 'student' && (
                      <>
                        {canEditAppointment(appointment) && (
                          <button
                            onClick={() => {
                              setEditingAppointment(appointment);
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                            title="Edit appointment"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canCancelAppointment(appointment) && (
                          <button
                            onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                            title="Cancel appointment"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                        {appointment.status === 'pending' && (
                          <button
                            onClick={() => deleteAppointment(appointment.id)}
                            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors"
                            title="Delete appointment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}

                    {profile?.role === 'staff' && (
                      <>
                        {appointment.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateAppointmentStatus(appointment.id, 'approved')}
                              className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateAppointmentStatus(appointment.id, 'declined')}
                              className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {appointment.status === 'approved' && !isPast(parseISO(`${appointment.appointment_date}T${appointment.end_time}`)) && (
                          <button
                            onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                            className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
                          >
                            Mark Complete
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setStaffNotesModal({ isOpen: true, appointment });
                            setStaffNotes(appointment.staff_notes || '');
                          }}
                          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-colors"
                          title="Add/Edit notes"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No appointments found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {statusFilter !== 'all' || searchTerm
                ? 'Try adjusting your filters to see more appointments.'
                : profile?.role === 'student'
                ? 'Book your first appointment to get started.'
                : 'Appointments will appear here once students book with you.'}
            </p>
            {profile?.role === 'student' && statusFilter === 'all' && !searchTerm && (
              <div className="mt-6">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Book Your First Appointment
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Appointment Modal */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAppointment(null);
        }}
        onSuccess={fetchAppointments}
        editingAppointment={editingAppointment}
      />

      {/* Staff Notes Modal */}
      {staffNotesModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                Staff Notes
              </h2>
              <button
                onClick={() => setStaffNotesModal({ isOpen: false, appointment: null })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <strong>Appointment:</strong> {staffNotesModal.appointment?.subject}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Student:</strong> {staffNotesModal.appointment?.student_profile?.full_name}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes about this appointment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStaffNotesModal({ isOpen: false, appointment: null })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStaffNotesSubmit}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Save Notes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;