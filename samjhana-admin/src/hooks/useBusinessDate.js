import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function useBusinessDate() {
  const [businessDate, setBusinessDate] = useState(new Date().toISOString().split('T')[0]);
  const [todayClosed, setTodayClosed] = useState(false);

  useEffect(() => {
    api.get('/api/daily-reports/business-date')
      .then(res => {
        setBusinessDate(res.data.date);
        setTodayClosed(res.data.todayClosed);
      })
      .catch(() => {
        // fallback to today
      });
  }, []);

  return { businessDate, todayClosed };
}
