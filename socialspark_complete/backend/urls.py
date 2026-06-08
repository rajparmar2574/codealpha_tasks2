from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from socialapp.views import (
    RegisterView, LoginView, MeView,
    UserDetailView, UserListView,
    FollowToggleView, FollowersListView, FollowingListView,
    PostListCreateView, UserPostsView, PostDetailView,
    LikeToggleView,
    CommentListCreateView, CommentDeleteView,
    NotificationListView, NotificationMarkReadView, NotificationUnreadCountView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth
    path('api/auth/register/', RegisterView.as_view()),
    path('api/auth/login/', LoginView.as_view()),
    path('api/auth/refresh/', TokenRefreshView.as_view()),

    # Me (current user)
    path('api/me/', MeView.as_view()),

    # Users
    path('api/users/', UserListView.as_view()),
    path('api/users/<str:username>/', UserDetailView.as_view()),
    path('api/users/<str:username>/follow/', FollowToggleView.as_view()),
    path('api/users/<str:username>/followers/', FollowersListView.as_view()),
    path('api/users/<str:username>/following/', FollowingListView.as_view()),
    path('api/users/<str:username>/posts/', UserPostsView.as_view()),

    # Posts
    path('api/posts/', PostListCreateView.as_view()),
    path('api/posts/<int:pk>/', PostDetailView.as_view()),
    path('api/posts/<int:pk>/like/', LikeToggleView.as_view()),
    path('api/posts/<int:pk>/comments/', CommentListCreateView.as_view()),

    # Comments
    path('api/comments/<int:pk>/', CommentDeleteView.as_view()),

    # Notifications
    path('api/notifications/', NotificationListView.as_view()),
    path('api/notifications/read/', NotificationMarkReadView.as_view()),
    path('api/notifications/unread-count/', NotificationUnreadCountView.as_view()),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
