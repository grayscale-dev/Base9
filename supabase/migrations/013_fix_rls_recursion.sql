CREATE OR REPLACE FUNCTION has_board_role(board_id uuid, roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM board_roles br
    WHERE br.board_id = has_board_role.board_id
      AND br.user_id = auth.uid()
      AND br.role = ANY (roles)
  );
$$;

CREATE OR REPLACE FUNCTION can_read_board(board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM boards b
    WHERE b.id = can_read_board.board_id
      AND b.visibility = 'public'
      AND b.status = 'active'
  )
  OR (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM board_roles br
      WHERE br.board_id = can_read_board.board_id
        AND br.user_id = auth.uid()
    )
  );
$$;
