<?php
$password = 'ku123456';

$hash = password_hash($password, PASSWORD_ARGON2ID, [
    'memory_cost' => 1 << 17, // 128 MB
    'time_cost'   => 4,       // iterations
    'threads'     => 2,
]);

echo "Hash: $hash\n";

$correctPassword = 'ku123456';
$wrongPassword = 'AB1234ab';
$wrongPassword2 = 'eshraq123456';
// Check against the correct password
if (password_verify($correctPassword, $hash)) {
    echo $correctPassword . "is a VALID Password!\n";
} else {
    echo $wrongPassword . " is an invalid password\n";
}

//Now check against the wrong password
if (password_verify($wrongPassword, $hash)) {
    echo $correctPassword . "is a VALID Password!\n";
} else {
    echo $wrongPassword2 . " is an INVALID password\n";
}
