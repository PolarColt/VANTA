import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Calendar, Clock, User, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format, addDays, startOfWeek } from 'date-fns';

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingAppointment?: any;
}

interface AppointmentForm {
  staff_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  subject: string;
  notes: string;
}

interface StaffMember {
  user_id: string;
  full_name: string;
  department?: string;
}

interface TimeSlot {
  start_time: string;
  end_time: string;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingAppointment,
}) => {
  const { profile } = useAuth();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AppointmentForm>();

  const selectedStaffId = watch('staff_id');
  const selectedDate = watch('appointment_date');

  useEffect(() => {
    if (isOpen) {
      fetchStaffMembers();
      if (editingAppointment) {
        setValue('staff_id', editingAppointment.staff_id);
        setValue('appointment_date', editingAppointment.appointment_date);
        setValue('start_time', editingAppointment.start_time);
        setValue('end_time', editingAppointment.end_time);
        setValue('subject', editingAppointment.subject || '');
        setValue('notes', editingAppointment.notes || '');
      }
    } else {
      reset();
    }
  }, [isOpen, editingAppointment, setValue, reset]);

  useEffect(() => {
    if (selectedStaffId && selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedStaffId, selectedDate]);

  const fetchStaffMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, department')
        .eq('role', 'staff');

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff members');
    }
  };

  const fetchAvailableSlots = async () => {
    if (!selectedStaffId || !selectedDate) return;

    setLoadingSlots(true);
    try {
      const selectedDateObj = new Date(selectedDate);
      const dayOfWeek = selectedDateObj.getDay();

      // Get staff availability for the selected day
      const { data: availability, error: availError } = await supabase
        .from('staff_availability')
        .select('start_time, end_time')
        .eq('staff_id', selectedStaffId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_available', true);

      if (availError) throw availError;

      // Get existing appointments for the selected date
      const { data: appointments, error: apptError } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('staff_id', selectedStaffId)
        .eq('appointment_date', selectedDate)
        .in('status', ['pending', 'approved']);

      if (apptError) throw apptError;

      // Generate available time slots
      const slots: TimeSlot[] = [];
      
      if (availability && availability.length > 0) {
        availability.forEach((avail) => {
          const startHour = parseInt(avail.start_time.split(':')[0]);
          const endHour = parseInt(avail.end_time.split(':')[0]);
          
          for (let hour = startHour; hour < endHour; hour++) {
            const startTime = `${hour.toString().padStart(2, '0')}:00`;
            const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
            
            // Check if this slot is already booked
            const isBooked = appointments?.some(apt => 
              apt.start_time === startTime || 
              (apt.start_time < startTime && apt.end_time > startTime)
            );
            
            if (!isBooked) {
              slots.push({ start_time: startTime, end_time: endTime });
            }
          }
        });
      }

      setAvailableSlots(slots);
    } catch (error) {
      console.error('Error fetching available slots:', error);
      toast.error('Failed to load available time slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  const onSubmit = async (data: AppointmentForm) => {
    if (!profile) return;

    setLoading(true);
    try {
      const appointmentData = {
        student_id: profile.user_id,
        staff_id: data.staff_id,
        appointment_date: data.appointment_date,
        start_time: data.start_time,
        end_time: data.end_time,
        subject: data.subject,
        notes: data.notes,
        status: 'pending' as const,
      };

      if (editingAppointment) {
        const { error } = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', editingAppointment.id);

        if (error) throw error;
        toast.success('Appointment updated successfully!');
      } else {
        const { error } = await supabase
          .from('appointments')
          .insert(appointmentData);

        if (error) throw error;
        toast.success('Appointment booked successfully!');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving appointment:', error);
      toast.error(error.message || 'Failed to save appointment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-600" />
            {editingAppointment ? 'Edit Appointment' : 'Book New Appointment'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="h-4 w-4 inline mr-1" />
              Select Staff Member
            </label>
            <select
              {...register('staff_id', { required: 'Please select a staff member' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choose a staff member...</option>
              {staffMembers.map((staff) => (
                <option key={staff.user_id} value={staff.user_id}>
                  {staff.full_name} {staff.department && `(${staff.department})`}
                </option>
              ))}
            </select>
            {errors.staff_id && (
              <p className="mt-1 text-sm text-red-600">{errors.staff_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="h-4 w-4 inline mr-1" />
              Appointment Date
            </label>
            <input
              {...register('appointment_date', { required: 'Please select a date' })}
              type="date"
              min={format(new Date(), 'yyyy-MM-dd')}
              max={format(addDays(new Date(), 30), 'yyyy-MM-dd')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.appointment_date && (
              <p className="mt-1 text-sm text-red-600">{errors.appointment_date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="h-4 w-4 inline mr-1" />
              Available Time Slots
            </label>
            {loadingSlots ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-500 mt-2">Loading available slots...</p>
              </div>
            ) : availableSlots.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {availableSlots.map((slot) => (
                  <label
                    key={`${slot.start_time}-${slot.end_time}`}
                    className="flex items-center p-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      {...register('start_time', { required: 'Please select a time slot' })}
                      type="radio"
                      value={slot.start_time}
                      onChange={() => setValue('end_time', slot.end_time)}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      {slot.start_time} - {slot.end_time}
                    </span>
                  </label>
                ))}
              </div>
            ) : selectedStaffId && selectedDate ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No available time slots for the selected date
              </p>
            ) : (
              <p className="text-sm text-gray-500 py-4 text-center">
                Please select staff member and date to see available slots
              </p>
            )}
            {errors.start_time && (
              <p className="mt-1 text-sm text-red-600">{errors.start_time.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText className="h-4 w-4 inline mr-1" />
              Subject
            </label>
            <input
              {...register('subject', { required: 'Please enter a subject' })}
              type="text"
              placeholder="e.g., Academic Consultation, Career Guidance"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.subject && (
              <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Any additional information or specific topics you'd like to discuss..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Saving...' : editingAppointment ? 'Update' : 'Book Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AppointmentModal;