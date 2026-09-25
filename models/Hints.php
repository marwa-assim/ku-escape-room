<?php
//models/Hints.php
class Hints {

    public static function getAllPresets(): array {
        $pdo = Database::getConnection();
        $stmt = $pdo->query('SELECT hint_text FROM Hints ORDER BY hint_id ASC');
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    public static function addPreset(string $text): void {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            'INSERT INTO hints (user_id, room_id, hint_text) VALUES (:user_id, :room_id, :text)'
        );
        $stmt->execute([
            'user_id' => $_SESSION['user_id'] ?? null,
            'room_id' => 1,
            'text'    => $text,
        ]);
    }
}
