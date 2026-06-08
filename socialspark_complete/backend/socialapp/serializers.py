from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Profile, Post, Like, Comment, Follow, Notification


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ['bio', 'avatar', 'website', 'location']


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    posts_count = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email',
                  'profile', 'followers_count', 'following_count', 'posts_count', 'is_following']

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_following_count(self, obj):
        return obj.following.count()

    def get_posts_count(self, obj):
        return obj.posts.count()

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Follow.objects.filter(follower=request.user, following=obj).exists()
        return False


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password', 'password2']

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        if User.objects.filter(username=data['username']).exists():
            raise serializers.ValidationError({'username': 'Username already taken.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        Profile.objects.get_or_create(user=user)
        return user


class CommentSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'author', 'author_username', 'author_name',
                  'author_avatar', 'content', 'created_at']
        read_only_fields = ['author', 'created_at']

    def get_author_name(self, obj):
        full = f"{obj.author.first_name} {obj.author.last_name}".strip()
        return full or obj.author.username

    def get_author_avatar(self, obj):
        request = self.context.get('request')
        try:
            if obj.author.profile.avatar and request:
                return request.build_absolute_uri(obj.author.profile.avatar.url)
        except Exception:
            pass
        return None


class PostSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source='author.username', read_only=True)
    author_name = serializers.SerializerMethodField()
    author_avatar = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    comments = CommentSerializer(many=True, read_only=True)

    class Meta:
        model = Post
        fields = ['id', 'author', 'author_username', 'author_name', 'author_avatar',
                  'content', 'image', 'created_at', 'updated_at',
                  'likes_count', 'comments_count', 'is_liked', 'comments']
        read_only_fields = ['author', 'created_at', 'updated_at']

    def get_author_name(self, obj):
        full = f"{obj.author.first_name} {obj.author.last_name}".strip()
        return full or obj.author.username

    def get_author_avatar(self, obj):
        request = self.context.get('request')
        try:
            if obj.author.profile.avatar and request:
                return request.build_absolute_uri(obj.author.profile.avatar.url)
        except Exception:
            pass
        return None

    def get_likes_count(self, obj):
        return obj.likes.count()

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Like.objects.filter(user=request.user, post=obj).exists()
        return False


class NotificationSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    sender_avatar = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'sender_username', 'sender_avatar', 'notif_type',
                  'message', 'post', 'is_read', 'created_at']

    def get_sender_avatar(self, obj):
        request = self.context.get('request')
        try:
            if obj.sender and obj.sender.profile.avatar and request:
                return request.build_absolute_uri(obj.sender.profile.avatar.url)
        except Exception:
            pass
        return None
