import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Clock, Calendar, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface AvailabilityForm {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const AvailabilityModal: React.FC<AvailabilityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { profile } = useAuth();
  const [existingSlots, setExistingSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AvailabilityForm>();

  useEffect(() => {
    if (isOpen && profile) {
      fetchExistingAvailability();
    } else {
      reset();
    }
  }, [isOpen, profile, reset]);

  const fetchExistingAvailability = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('staff_id', profile.user_id)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;
      setExistingSlots(data || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
      toast.error('Failed to load existing availability');
    }
  };

  const onSubmit = async (data: AvailabilityForm) => {
    if (!profile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('staff_availability')
        .insert({
          staff_id: profile.user_id,
          day_of_week: data.day_of_week,
          start_time: data.start_time,
          end_time: data.end_time,
          is_available: true,
        });

      if (error) throw error;

      toast.success('Availability added successfully!');
      reset();
      fetchExistingAvailability();
    } catch (error: any) {
      console.error('Error adding availability:', error);
      toast.error(error.message || 'Failed to add availability');
    } finally {
      setLoading(false);
    }
  };

  const deleteSlot = async (slotId: string) => {
    try {
      const { error } = await supabase
        .from('staff_availability')
        .delete()
        .eq('id', slotId);

      if (error) throw error;

      toast.success('Availability slot removed');
      fetchExistingAvailability();
    } catch (error) {
      console.error('Error deleting slot:', error);
      toast.error('Failed to remove availability slot');
    }
  };

  const toggleSlotAvailability = async (slotId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('staff_availability')
        .update({ is_available: !currentStatus })
        .eq('id', slotId);

      if (error) throw error;

      toast.success(`Availability ${!currentStatus ? 'enabled' : 'disabled'}`);
      fetchExistingAvailability();
    } catch (error) {
      console.error('Error updating availability:', error);
      toast.error('Failed to update availability');
    }
  };

  const getDayName = (dayNumber: number) => {
    return DAYS_OF_WEEK.find(day => day.value === dayNumber)?.label || 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            Manage Availability
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Add New Availability Form */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Add New Availability
            </h3>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Day of Week
                  </label>
                  <select
                    {...register('day_of_week', { 
                      required: 'Please select a day',
                      valueAsNumber: true 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select day...</option>
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                  {errors.day_of_week && (
                    <p className="mt-1 text-sm text-red-600">{errors.day_of_week.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    {...register('start_time', { required: 'Please select start time' })}
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.start_time && (
                    <p className="mt-1 text-sm text-red-600">{errors.start_time.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    {...register('end_time', { required: 'Please select end time' })}
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {errors.end_time && (
                    <p className="mt-1 text-sm text-red-600">{errors.end_time.message}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Adding...' : 'Add Availability'}
              </button>
            </form>
          </div>

          {/* Existing Availability */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Current Availability
            </h3>

            {existingSlots.length > 0 ? (
              <div className="space-y-2">
                {existingSlots.map((slot) => (
                  <div
                    key={slot.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      slot.is_available ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900">
                        {getDayName(slot.day_of_week)}
                      </span>
                      <span className="text-gray-600">
                        {slot.start_time} - {slot.end_time}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        slot.is_available 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {slot.is_available ? 'Available' : 'Disabled'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => toggleSlotAvailability(slot.id, slot.is_available)}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          slot.is_available
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        {slot.is_available ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => deleteSlot(slot.id)}
                        className="p-1 text-red-600 hover:text-red-800 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No availability set</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add your available time slots to allow students to book appointments.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-6">
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityModal;