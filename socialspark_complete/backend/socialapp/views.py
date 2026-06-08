from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from .models import Profile, Post, Like, Comment, Follow, Notification
from .serializers import (
    UserSerializer, RegisterSerializer, PostSerializer,
    CommentSerializer, ProfileSerializer, NotificationSerializer
)


# ─── AUTH ─────────────────────────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user, context={'request': request}).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        if not username or not password:
            return Response({'error': 'Username and password required.'}, status=400)
        user = authenticate(username=username, password=password)
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'user': UserSerializer(user, context={'request': request}).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            })
        return Response({'error': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)


# ─── ME ───────────────────────────────────────────────────────────────────────

class MeView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        return Response(UserSerializer(request.user, context={'request': request}).data)

    def patch(self, request):
        user = request.user
        for field in ['first_name', 'last_name', 'email']:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()

        profile, _ = Profile.objects.get_or_create(user=user)
        for field in ['bio', 'website', 'location']:
            if field in request.data:
                setattr(profile, field, request.data[field])
        if 'avatar' in request.FILES:
            profile.avatar = request.FILES['avatar']
        profile.save()

        return Response(UserSerializer(user, context={'request': request}).data)


# ─── USERS ────────────────────────────────────────────────────────────────────

class UserDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        user = get_object_or_404(User, username=username)
        return Response(UserSerializer(user, context={'request': request}).data)


class UserListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = UserSerializer

    def get_queryset(self):
        q = self.request.query_params.get('q', '')
        qs = User.objects.all().order_by('-date_joined')
        if q:
            qs = qs.filter(username__icontains=q)
        return qs

    def get_serializer_context(self):
        return {'request': self.request}


# ─── FOLLOW ───────────────────────────────────────────────────────────────────

class FollowToggleView(APIView):
    def post(self, request, username):
        target = get_object_or_404(User, username=username)
        if target == request.user:
            return Response({'error': 'Cannot follow yourself.'}, status=400)
        follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
        if not created:
            follow.delete()
            return Response({'following': False, 'followers_count': target.followers.count()})
        return Response({'following': True, 'followers_count': target.followers.count()})


class FollowersListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        user = get_object_or_404(User, username=username)
        followers = User.objects.filter(following__following=user)
        return Response(UserSerializer(followers, many=True, context={'request': request}).data)


class FollowingListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        user = get_object_or_404(User, username=username)
        following = User.objects.filter(followers__follower=user)
        return Response(UserSerializer(following, many=True, context={'request': request}).data)


# ─── POSTS ────────────────────────────────────────────────────────────────────

class PostListCreateView(generics.ListCreateAPIView):
    serializer_class = PostSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        feed = self.request.query_params.get('feed', 'false')
        if feed == 'true' and self.request.user.is_authenticated:
            following_ids = Follow.objects.filter(
                follower=self.request.user
            ).values_list('following_id', flat=True)
            ids = list(following_ids) + [self.request.user.id]
            return Post.objects.filter(author_id__in=ids).select_related('author', 'author__profile')
        return Post.objects.all().select_related('author', 'author__profile')

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def get_serializer_context(self):
        return {'request': self.request}


class UserPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = get_object_or_404(User, username=self.kwargs['username'])
        return Post.objects.filter(author=user).select_related('author', 'author__profile')

    def get_serializer_context(self):
        return {'request': self.request}


class PostDetailView(generics.RetrieveDestroyAPIView):
    queryset = Post.objects.all().select_related('author', 'author__profile')
    serializer_class = PostSerializer

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        if post.author != request.user:
            return Response({'error': 'Not your post.'}, status=403)
        post.delete()
        return Response(status=204)

    def get_serializer_context(self):
        return {'request': self.request}


# ─── LIKES ────────────────────────────────────────────────────────────────────

class LikeToggleView(APIView):
    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        like, created = Like.objects.get_or_create(user=request.user, post=post)
        if not created:
            like.delete()
            return Response({'liked': False, 'likes_count': post.likes.count()})
        return Response({'liked': True, 'likes_count': post.likes.count()})


# ─── COMMENTS ─────────────────────────────────────────────────────────────────

class CommentListCreateView(generics.ListCreateAPIView):
    serializer_class = CommentSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        return Comment.objects.filter(post_id=self.kwargs['pk']).select_related('author', 'author__profile')

    def perform_create(self, serializer):
        post = get_object_or_404(Post, pk=self.kwargs['pk'])
        serializer.save(author=self.request.user, post=post)

    def get_serializer_context(self):
        return {'request': self.request}


class CommentDeleteView(generics.DestroyAPIView):
    queryset = Comment.objects.all()

    def destroy(self, request, *args, **kwargs):
        comment = self.get_object()
        if comment.author != request.user:
            return Response({'error': 'Not your comment.'}, status=403)
        comment.delete()
        return Response(status=204)


# ─── NOTIFICATIONS ─────────────────────────────────────────────────────────────

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).select_related('sender', 'sender__profile')

    def get_serializer_context(self):
        return {'request': self.request}


class NotificationMarkReadView(APIView):
    def post(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({'status': 'ok'})


class NotificationUnreadCountView(APIView):
    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'unread': count})
