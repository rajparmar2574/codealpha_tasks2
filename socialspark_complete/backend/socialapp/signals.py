from django.db.models.signals import post_save
from django.contrib.auth.models import User
from django.dispatch import receiver
from .models import Profile, Like, Comment, Follow, Notification


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    """Auto-create a Profile whenever a new User is created."""
    if created:
        Profile.objects.get_or_create(user=instance)


@receiver(post_save, sender=Like)
def notify_like(sender, instance, created, **kwargs):
    """Notify post author when someone likes their post."""
    if created and instance.user != instance.post.author:
        Notification.objects.create(
            recipient=instance.post.author,
            sender=instance.user,
            notif_type='like',
            post=instance.post,
            message=f"{instance.user.username} liked your post.",
        )


@receiver(post_save, sender=Comment)
def notify_comment(sender, instance, created, **kwargs):
    """Notify post author when someone comments on their post."""
    if created and instance.author != instance.post.author:
        Notification.objects.create(
            recipient=instance.post.author,
            sender=instance.author,
            notif_type='comment',
            post=instance.post,
            message=f"{instance.author.username} commented: \"{instance.content[:60]}\"",
        )


@receiver(post_save, sender=Follow)
def notify_follow(sender, instance, created, **kwargs):
    """Notify user when someone follows them."""
    if created:
        Notification.objects.create(
            recipient=instance.following,
            sender=instance.follower,
            notif_type='follow',
            message=f"{instance.follower.username} started following you.",
        )
