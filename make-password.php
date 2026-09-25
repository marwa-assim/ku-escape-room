<?php

$passwords = [
    'Ahmed'  => 'KU@Ahmed2026',
    'Omar'   => 'KU@Omar2026',
    'Ali'    => 'KU@Ali2026',
    'Hassan' => 'KU@Hassan2026',
    'Khalid' => 'KU@Khalid2026'
];

header('Content-Type: text/plain; charset=utf-8');

foreach ($passwords as $username => $password) {
    echo $username . " | " . $password . " | " .
         password_hash($password, PASSWORD_DEFAULT) . PHP_EOL;
}
