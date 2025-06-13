import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Clock, Calendar, Plus, Settings, Users, TrendingUp } from 'lucide-react';
import AvailabilityModal from '../components/AvailabilityModal';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface WeeklyStats {
  totalSlots: number;
  bookedSlots: number;
  availableSlots: number;
  pendingAppointments: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

const Availability: React.FC = () => {
  const { profile } = useAuth();
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    totalSlots: 0,
    bookedSlots: 0,
    availableSlots: 0,
    pendingAppointments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date()));

  useEffect(() => {
    if (profile) {
      fetchAvailabilityData();
      fetchWeeklyStats();
    }
  }, [profile, currentWeek]);

  const fetchAvailabilityData = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('staff_id', profile.user_id)
        .order('day_of_week')
        .order('start_time');

      if (error) throw error;
      setAvailabilitySlots(data || []);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyStats = async () => {
    if (!profile) return;

    try {
      // Get total availability slots for the week
      const { data: availability, error: availError } = await supabase
        .from('staff_availability')
        .select('*')
        .eq('staff_id', profile.user_id)
        .eq('is_available', true);

      if (availError) throw availError;

      // Get appointments for the current week
      const weekStart = format(currentWeek, 'yyyy-MM-dd');
      const weekEnd = format(addDays(currentWeek, 6), 'yyyy-MM-dd');

      const { data: appointments, error: apptError } = await supabase
        .from('appointments')
        .select('*')
        .eq('staff_id', profile.user_id)
        .gte('appointment_date', weekStart)
        .lte('appointment_date', weekEnd);

      if (apptError) throw apptError;

      const totalSlots = availability?.length || 0;
      const bookedSlots = appointments?.filter(apt => 
        ['approved', 'pending'].includes(apt.status)
      ).length || 0;
      const pendingAppointments = appointments?.filter(apt => 
        apt.status === 'pending'
      ).length || 0;

      setWeeklyStats({
        totalSlots,
        bookedSlots,
        availableSlots: totalSlots - bookedSlots,
        pendingAppointments,
      });
    } catch (error) {
      console.error('Error fetching weekly stats:', error);
    }
  };

  const getSlotsByDay = (dayOfWeek: number) => {
    return availabilitySlots.filter(slot => slot.day_of_week === dayOfWeek);
  };

  const getDayDate = (dayOfWeek: number) => {
    return addDays(currentWeek, dayOfWeek);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = addDays(currentWeek, direction === 'next' ? 7 : -7);
    setCurrentWeek(newWeek);
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
          <h1 className="text-2xl font-bold text-gray-900">Availability Management</h1>
          <p className="text-gray-600 mt-1">
            Set your available time slots for student appointments
          </p>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Manage Availability
        </button>
      </div>

      {/* Weekly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Slots</p>
              <p className="text-2xl font-semibold text-gray-900">{weeklyStats.totalSlots}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Booked</p>
              <p className="text-2xl font-semibold text-gray-900">{weeklyStats.bookedSlots}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available</p>
              <p className="text-2xl font-semibold text-gray-900">{weeklyStats.availableSlots}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingUp className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">{weeklyStats.pendingAppointments}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-900">Weekly Schedule</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigateWeek('prev')}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Previous Week
            </button>
            <span className="text-sm font-medium text-gray-900">
              {format(currentWeek, 'MMM dd')} - {format(addDays(currentWeek, 6), 'MMM dd, yyyy')}
            </span>
            <button
              onClick={() => navigateWeek('next')}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Next Week
            </button>
          </div>
        </div>

        {/* Weekly Calendar Grid */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {DAYS_OF_WEEK.map((day) => {
            const daySlots = getSlotsByDay(day.value);
            const dayDate = getDayDate(day.value);
            const isToday = isSameDay(dayDate, new Date());

            return (
              <div
                key={day.value}
                className={`border rounded-lg p-4 ${
                  isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="text-center mb-3">
                  <h3 className={`font-medium ${isToday ? 'text-blue-900' : 'text-gray-900'}`}>
                    {day.short}
                  </h3>
                  <p className={`text-sm ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>
                    {format(dayDate, 'MMM dd')}
                  </p>
                </div>

                <div className="space-y-2">
                  {daySlots.length > 0 ? (
                    daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`text-xs p-2 rounded text-center ${
                          slot.is_available
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {slot.start_time} - {slot.end_time}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-2">
                      No availability set
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Quick Actions
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <div className="text-center">
              <Plus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Add Time Slots</p>
              <p className="text-xs text-gray-500">Set new availability</p>
            </div>
          </button>

          <div className="flex items-center justify-center p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="text-center">
              <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Bulk Schedule</p>
              <p className="text-xs text-gray-500">Coming soon</p>
            </div>
          </div>

          <div className="flex items-center justify-center p-4 border border-gray-200 rounded-lg bg-gray-50">
            <div className="text-center">
              <TrendingUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-900">Analytics</p>
              <p className="text-xs text-gray-500">Coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Availability Modal */}
      <AvailabilityModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchAvailabilityData();
          fetchWeeklyStats();
        }}
      />
    </div>
  );
};

export default Availability;