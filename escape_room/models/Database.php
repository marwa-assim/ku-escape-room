<?php
// models/Database.php
// Local defaults preserve the original XAMPP behaviour.
// On Render, values are supplied securely through environment variables.
class Database {
    private static ?PDO $connection = null;

    public static function getConnection(): PDO {
        if (self::$connection === null) {
            $host = getenv('DB_HOST') ?: 'localhost';
            $port = getenv('DB_PORT') ?: '3306';
            $dbname = getenv('DB_NAME') ?: 'game_database';
            $username = getenv('DB_USER') ?: 'root';
            $password = getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : '';

            try {
                self::$connection = new PDO(
                    "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4",
                    $username,
                    $password,
                    [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                    ]
                );
            } catch (PDOException $e) {
                error_log('Database connection failed: ' . $e->getMessage());
                http_response_code(500);
                die('Database connection failed. Please contact the game administrator.');
            }
        }
        return self::$connection;
    }
}
