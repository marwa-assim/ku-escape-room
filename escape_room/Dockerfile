FROM php:8.2-apache

RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite headers

COPY . /var/www/html/
RUN chown -R www-data:www-data /var/www/html

# Render sends public HTTP traffic to $PORT. Apache reads it at startup.
CMD ["bash", "-lc", "sed -i \"s/Listen 80/Listen ${PORT:-10000}/\" /etc/apache2/ports.conf && sed -i \"s/<VirtualHost \\*:80>/<VirtualHost *:${PORT:-10000}>/\" /etc/apache2/sites-available/000-default.conf && apache2-foreground"]
