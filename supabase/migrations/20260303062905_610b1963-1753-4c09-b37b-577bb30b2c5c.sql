-- Delete employee data in FK-safe order
DELETE FROM session_payments WHERE session_id IN (SELECT id FROM daily_sessions WHERE employee_id = '9c23adda-d865-49fb-8155-ef14d2648183');
DELETE FROM daily_sessions WHERE employee_id = '9c23adda-d865-49fb-8155-ef14d2648183';
DELETE FROM user_roles WHERE user_id = '9c23adda-d865-49fb-8155-ef14d2648183';
DELETE FROM employees WHERE user_id = '9c23adda-d865-49fb-8155-ef14d2648183';