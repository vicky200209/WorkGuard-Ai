import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface RealtimeSubscriptionProps<T extends { [key: string]: any }> {
  table: string;
  filter?: string; // e.g., "user_id=eq.123"
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onEvent: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean;
}

export function useRealtime<T extends { [key: string]: any }>({
  table,
  filter,
  event = '*',
  onEvent,
  enabled = true,
}: RealtimeSubscriptionProps<T>) {
  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime:${table}:${event}:${filter || 'all'}`;
    
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        {
          event,
          schema: 'public',
          table,
          filter,
        },
        (payload) => {
          onEvent(payload as RealtimePostgresChangesPayload<T>);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Supabase Realtime Subscribed to table [${table}] successfully`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, event, enabled, onEvent]);
}
