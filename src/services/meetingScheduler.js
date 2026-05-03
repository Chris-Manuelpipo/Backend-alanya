// src/services/meetingScheduler.js
//
// Service de scheduler pour envoyer les notifications 10 minutes avant une réunion

const pool = require('../config/db');
const { notifyMeetingReminder } = require('./notificationService');

let schedulerInterval = null;

const startMeetingScheduler = async () => {
  console.log('[MeetingScheduler] Démarrage du scheduler de notifications');

  // Vérifier toutes les minutes les réunions qui commencent dans 10 minutes
  schedulerInterval = setInterval(async () => {
    try {
      await checkAndNotifyUpcomingMeetings();
    } catch (error) {
      console.error('[MeetingScheduler] Erreur:', error.message);
    }
  }, 60000); // Vérifier chaque minute
};

const stopMeetingScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[MeetingScheduler] Arrêt du scheduler');
  }
};

const checkAndNotifyUpcomingMeetings = async () => {
  try {
    // Trouver les réunions qui commencent dans les 10 minutes (UTC)
    // et pour lesquelles aucune notification n'a été envoyée (reminder_sent = 0)
    const [meetings] = await pool.execute(
      `SELECT m.idMeeting, m.objet, m.start_time, m.idOrganiser, u.nom as organiser_nom
       FROM meeting m
       JOIN users u ON m.idOrganiser = u.alanyaID
       WHERE m.isEnd = 0
         AND m.start_time > NOW() 
         AND m.start_time <= DATE_ADD(NOW(), INTERVAL 10 MINUTE)
         AND m.reminder_sent = 0`
    );

    if (meetings.length === 0) {
      return; // Rien à notifier
    }

    console.log(`[MeetingScheduler] ${meetings.length} réunion(s) à notifier`);

    for (const meeting of meetings) {
      console.log(
        `[MeetingScheduler] Traitement de la réunion: idMeeting=${meeting.idMeeting}, objet='${meeting.objet}'`
      );

      // Trouver tous les participants acceptés et en attente (status 0 ou 1)
      const [participants] = await pool.execute(
        `SELECT DISTINCT p.IDparticipant
         FROM participant p
         WHERE p.idMeeting = ? AND p.status IN (0, 1)`,
        [meeting.idMeeting]
      );

      if (participants.length === 0) {
        console.log(`[MeetingScheduler] Aucun participant pour réunion ${meeting.idMeeting}`);
      } else {
        console.log(
          `[MeetingScheduler] ${participants.length} participant(s) à notifier pour réunion ${meeting.idMeeting}`
        );
      }

      // Notifier chaque participant
      for (const p of participants) {
        try {
          await notifyMeetingReminder(
            p.IDparticipant,
            meeting.objet,
            meeting.organiser_nom
          );
          console.log(
            `[MeetingScheduler] Notification envoyée au participant ${p.IDparticipant} pour réunion ${meeting.idMeeting}`
          );
        } catch (error) {
          console.error(
            `[MeetingScheduler] Erreur notification participant ${p.IDparticipant} pour réunion ${meeting.idMeeting}:`,
            error.message
          );
        }
      }

      // Marquer la réunion comme rappel notifié
      try {
        await pool.execute(
          `UPDATE meeting SET reminder_sent = 1 WHERE idMeeting = ?`,
          [meeting.idMeeting]
        );
        console.log(
          `[MeetingScheduler] ✓ Rappel notifié pour réunion idMeeting=${meeting.idMeeting}, objet='${meeting.objet}'`
        );
      } catch (error) {
        console.error(
          `[MeetingScheduler] Erreur mise à jour reminder_sent pour réunion ${meeting.idMeeting}:`,
          error.message
        );
      }
    }
  } catch (error) {
    console.error('[MeetingScheduler] Erreur checkAndNotifyUpcomingMeetings:', error.message);
  }
};

module.exports = {
  startMeetingScheduler,
  stopMeetingScheduler,
  checkAndNotifyUpcomingMeetings,
};
